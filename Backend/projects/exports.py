"""
NICARA — Estimate and Booking Form exports.

Server-side generation so the PDF a client receives is byte-identical no
matter who downloaded it, and so the numbers come from the same code path
that computes them everywhere else.

    estimate_pdf(estimate)   → bytes
    estimate_xlsx(estimate)  → bytes
    booking_pdf(booking)     → bytes

Layout mirrors the existing NICARA quote template: gold rules, dark header
band, line items grouped by area, then totals, payment schedule and terms.
"""
import io
from decimal import Decimal

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

# ── Brand ───────────────────────────────────────────────────
GOLD = colors.HexColor('#C9A96E')
DARK = colors.HexColor('#1A1A2E')
GREY = colors.HexColor('#6B7280')
LIGHT = colors.HexColor('#F9F8F6')
LINE = colors.HexColor('#E7E5E4')

COMPANY = 'NICARA DESIGN'
COMPANY_TAGLINE = 'Interior Design & Build'


def rupees(value):
    """₹ with Indian digit grouping."""
    amount = Decimal(value or 0)
    whole = int(amount)
    negative = whole < 0
    digits = str(abs(whole))

    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        formatted = ','.join(groups + [tail])
    else:
        formatted = digits

    return f"{'-' if negative else ''}Rs. {formatted}"


# ════════════════════════════════════════════════════════════
# PDF
# ════════════════════════════════════════════════════════════

def _styles():
    base = getSampleStyleSheet()
    return {
        'title': ParagraphStyle('t', parent=base['Normal'], fontName='Helvetica-Bold',
                                fontSize=20, textColor=GOLD, leading=24),
        'tagline': ParagraphStyle('tag', parent=base['Normal'], fontName='Helvetica',
                                  fontSize=8, textColor=GREY, leading=11),
        'h2': ParagraphStyle('h2', parent=base['Normal'], fontName='Helvetica-Bold',
                             fontSize=11, textColor=DARK, spaceAfter=4),
        'body': ParagraphStyle('b', parent=base['Normal'], fontName='Helvetica',
                               fontSize=8.5, textColor=DARK, leading=12),
        'small': ParagraphStyle('s', parent=base['Normal'], fontName='Helvetica',
                                fontSize=7.5, textColor=GREY, leading=10),
        'cell': ParagraphStyle('c', parent=base['Normal'], fontName='Helvetica',
                               fontSize=8, textColor=DARK, leading=10.5),
        'cellb': ParagraphStyle('cb', parent=base['Normal'], fontName='Helvetica-Bold',
                                fontSize=8, textColor=DARK, leading=10.5),
        'right': ParagraphStyle('r', parent=base['Normal'], fontName='Helvetica',
                                fontSize=8, alignment=TA_RIGHT, textColor=DARK),
        'centre': ParagraphStyle('ctr', parent=base['Normal'], fontName='Helvetica',
                                 fontSize=8, alignment=TA_CENTER, textColor=GREY),
    }


def _letterhead(story, s, doc_title, reference):
    header = Table(
        [[
            Paragraph(f'{COMPANY}<br/><font size=7 color="#6B7280">{COMPANY_TAGLINE}</font>', s['title']),
            Paragraph(
                f'<b>{doc_title}</b><br/>'
                f'<font size=8 color="#6B7280">{reference}</font>',
                ParagraphStyle('hr', parent=s['body'], alignment=TA_RIGHT, fontSize=12),
            ),
        ]],
        colWidths=[95 * mm, 75 * mm],
    )
    header.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -1), 1.6, GOLD),
    ]))
    story.append(header)
    story.append(Spacer(1, 7 * mm))


def _info_block(story, s, left_title, left_rows, right_title, right_rows):
    def block(title, rows):
        lines = ''.join(
            f'<b>{label}:</b> {value or "—"}<br/>' for label, value in rows
        )
        return Paragraph(
            f'<font size=7 color="#C9A96E"><b>{title.upper()}</b></font><br/><br/>{lines}',
            s['body'],
        )

    table = Table([[block(left_title, left_rows), block(right_title, right_rows)]],
                  colWidths=[85 * mm, 85 * mm])
    table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, LINE),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, LINE),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    story.append(table)
    story.append(Spacer(1, 6 * mm))


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(1.2)
    canvas.line(20 * mm, 15 * mm, 190 * mm, 15 * mm)
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(GREY)
    canvas.drawString(20 * mm, 10 * mm, f'{COMPANY} · {COMPANY_TAGLINE}')
    canvas.drawRightString(190 * mm, 10 * mm, f'Page {doc.page}')
    canvas.restoreState()


def _document(buffer, title):
    return SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=16 * mm, bottomMargin=22 * mm,
        title=title, author=COMPANY,
    )


def estimate_pdf(estimate):
    """Render an estimate to PDF bytes."""
    project = estimate.project
    s = _styles()
    buffer = io.BytesIO()
    doc = _document(buffer, f'{estimate.get_type_display()} — {project.name}')
    story = []

    reference = (f'{estimate.get_type_display()}<br/>'
                 f'Version {estimate.version} · {estimate.created_at:%d %b %Y}')
    _letterhead(story, s, 'QUOTATION', reference)

    _info_block(
        story, s,
        'Client', [
            ('Name', project.client_name),
            ('Phone', project.client_phone),
            ('Email', project.client_email),
            ('Address', project.client_address),
        ],
        'Project', [
            ('Project', project.name),
            ('Developer', project.developer),
            ('Unit', project.unit_no),
            ('Area', f'{project.area} · {project.get_property_type_display()}'),
        ],
    )

    # ── Line items, grouped by area ──
    header = ['S.No', 'Item & Description', 'L', 'B', 'H', 'Qty', 'Unit', 'Rate', 'Amount']
    widths = [11 * mm, 62 * mm, 13 * mm, 13 * mm, 13 * mm, 13 * mm, 13 * mm, 21 * mm, 24 * mm]

    rows = [[Paragraph(f'<b>{h}</b>', ParagraphStyle(
        'th', parent=s['cell'], textColor=colors.white,
        alignment=TA_RIGHT if h in ('Rate', 'Amount') else 0)) for h in header]]

    style = [
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.4, LINE),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]

    current_area = None
    index = 0
    for item in estimate.items.all():
        if item.area != current_area:
            current_area = item.area
            rows.append([Paragraph(f'<b>{current_area or "General"}</b>', s['cellb'])]
                        + [''] * (len(header) - 1))
            row_index = len(rows) - 1
            style += [
                ('SPAN', (0, row_index), (-1, row_index)),
                ('BACKGROUND', (0, row_index), (-1, row_index), LIGHT),
                ('TEXTCOLOR', (0, row_index), (-1, row_index), GOLD),
            ]

        index += 1
        description = item.item
        if item.description:
            description += f'<br/><font size=7 color="#6B7280">{item.description}</font>'

        rows.append([
            Paragraph(str(index), s['cell']),
            Paragraph(description, s['cell']),
            Paragraph(item.length or '—', s['cell']),
            Paragraph(item.breadth or '—', s['cell']),
            Paragraph(item.height or '—', s['cell']),
            Paragraph(f'{item.qty:g}', s['cell']),
            Paragraph(item.unit or '', s['cell']),
            Paragraph(rupees(item.rate), s['right']),
            Paragraph(f'<b>{rupees(item.amount)}</b>', s['right']),
        ])

    if index == 0:
        rows.append([Paragraph('No line items on this estimate.', s['cell'])]
                    + [''] * (len(header) - 1))
        style.append(('SPAN', (0, 1), (-1, 1)))

    table = Table(rows, colWidths=widths, repeatRows=1)
    table.setStyle(TableStyle(style))
    story.append(table)
    story.append(Spacer(1, 5 * mm))

    # ── Totals ──
    total_rows = [['Subtotal', rupees(estimate.subtotal)]]
    if estimate.total_discount:
        total_rows.append(['Discount', f'- {rupees(estimate.total_discount)}'])
        total_rows.append(['Taxable Amount', rupees(estimate.taxable_amount)])
    total_rows.append(['GST', rupees(estimate.gst_total)])
    total_rows.append(['GRAND TOTAL', rupees(estimate.grand_total)])

    totals = Table(
        [[Paragraph(label, s['cellb'] if 'GRAND' in label else s['cell']),
          Paragraph(f'<b>{value}</b>' if 'GRAND' in label else value, s['right'])]
         for label, value in total_rows],
        colWidths=[45 * mm, 40 * mm], hAlign='RIGHT',
    )
    totals.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.4, LINE),
        ('BACKGROUND', (0, -1), (-1, -1), DARK),
        ('TEXTCOLOR', (0, -1), (-1, -1), GOLD),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(totals)
    story.append(Spacer(1, 8 * mm))

    # ── Payment schedule ──
    milestones = list(project.payment_milestones.all())
    if milestones:
        payment_rows = [['S.No', 'Milestone', 'Due Date', 'Amount', 'Status']]
        for n, milestone in enumerate(milestones, start=1):
            payment_rows.append([
                str(n), milestone.milestone, str(milestone.due_date),
                rupees(milestone.amount), milestone.get_status_display(),
            ])
        payments = Table(payment_rows,
                         colWidths=[13 * mm, 66 * mm, 27 * mm, 30 * mm, 27 * mm])
        payments.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), DARK),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.4, LINE),
            ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(KeepTogether([
            Paragraph('Payment Schedule', s['h2']), Spacer(1, 2 * mm), payments,
        ]))
        story.append(Spacer(1, 7 * mm))

    # ── Notes & terms ──
    terms = [
        'This quotation is valid for 30 days from the date of issue.',
        'Rates are inclusive of material and labour unless stated otherwise.',
        'GST is charged at the applicable rate against each line item.',
        'Any change in scope will be quoted separately before execution.',
        'Execution begins after the booking advance is received.',
    ]
    if estimate.valid_until:
        terms[0] = f'This quotation is valid until {estimate.valid_until:%d %b %Y}.'
    if estimate.notes:
        terms.insert(0, estimate.notes)

    story.append(KeepTogether([
        Paragraph('Terms & Conditions', s['h2']),
        Spacer(1, 2 * mm),
        *[Paragraph(f'{n}. {t}', s['small']) for n, t in enumerate(terms, start=1)],
        Spacer(1, 10 * mm),
        Table([[
            Paragraph('_______________________<br/><font size=7>For NICARA Design</font>', s['small']),
            Paragraph('_______________________<br/><font size=7>Client Acceptance</font>',
                      ParagraphStyle('sr', parent=s['small'], alignment=TA_RIGHT)),
        ]], colWidths=[85 * mm, 85 * mm]),
    ]))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    return buffer.read()


def booking_pdf(booking):
    """Render a booking form to PDF bytes."""
    project = booking.project
    s = _styles()
    buffer = io.BytesIO()
    doc = _document(buffer, f'Booking Form — {project.name}')
    story = []

    _letterhead(story, s, 'BOOKING FORM',
                f'{booking.booking_number}<br/>{booking.booking_date:%d %b %Y}')

    _info_block(
        story, s,
        'Client', [
            ('Name', project.client_name),
            ('Phone', project.client_phone),
            ('Email', project.client_email),
            ('Address', project.client_address),
        ],
        'Project', [
            ('Project', project.name),
            ('Developer', project.developer),
            ('Unit', project.unit_no),
            ('Area', f'{project.area} · {project.get_property_type_display()}'),
        ],
    )

    if booking.scope_summary:
        story.append(Paragraph('Scope of Work', s['h2']))
        story.append(Paragraph(booking.scope_summary, s['body']))
        story.append(Spacer(1, 6 * mm))

    money_rows = [
        ['Agreed Project Value', rupees(booking.total_value)],
        ['Booking Advance', rupees(booking.advance_amount)],
        ['Advance Received', 'Yes' if booking.advance_received else 'No'],
    ]
    if booking.advance_received:
        money_rows += [
            ['Received On', str(booking.advance_received_on or '—')],
            ['Payment Mode', booking.payment_mode or '—'],
            ['Reference', booking.payment_reference or '—'],
        ]
    money_rows.append(['BALANCE DUE', rupees(booking.balance_due)])

    money = Table(
        [[Paragraph(label, s['cellb'] if 'BALANCE' in label else s['cell']),
          Paragraph(value, ParagraphStyle('mr', parent=s['right'],
                                          fontName='Helvetica-Bold' if 'BALANCE' in label
                                          else 'Helvetica'))]
         for label, value in money_rows],
        colWidths=[95 * mm, 75 * mm],
    )
    money.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.4, LINE),
        ('BACKGROUND', (0, -1), (-1, -1), DARK),
        ('TEXTCOLOR', (0, -1), (-1, -1), GOLD),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(money)
    story.append(Spacer(1, 8 * mm))

    terms = booking.terms or (
        'The booking advance confirms this engagement and is adjusted against '
        'the final invoice. It is non-refundable once design work begins. '
        'The balance is payable against the milestone schedule agreed with '
        'this booking. Any change in scope will be quoted separately.'
    )
    story.append(Paragraph('Terms', s['h2']))
    story.append(Paragraph(terms, s['small']))
    story.append(Spacer(1, 12 * mm))

    signed = booking.signed_by_name or '_______________________'
    signed_note = (f'Signed digitally on {booking.signed_at:%d %b %Y, %I:%M %p}'
                   if booking.signed_at else 'Client signature')

    story.append(Table([[
        Paragraph('_______________________<br/><font size=7>For NICARA Design</font>', s['small']),
        Paragraph(f'{signed}<br/><font size=7>{signed_note}</font>',
                  ParagraphStyle('sg', parent=s['small'], alignment=TA_RIGHT)),
    ]], colWidths=[85 * mm, 85 * mm]))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    return buffer.read()


# ════════════════════════════════════════════════════════════
# Excel
# ════════════════════════════════════════════════════════════

THIN = Side(style='thin', color='E7E5E4')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HEADER_FILL = PatternFill('solid', fgColor='1A1A2E')
AREA_FILL = PatternFill('solid', fgColor='F9F8F6')
TOTAL_FILL = PatternFill('solid', fgColor='C9A96E')
MONEY = '#,##,##0.00'


def estimate_xlsx(estimate):
    """Render an estimate to .xlsx bytes."""
    project = estimate.project
    wb = Workbook()
    ws = wb.active
    ws.title = 'Estimate'

    columns = [
        ('S.No', 7), ('Area', 20), ('Item', 30), ('Description', 40),
        ('L', 10), ('B', 10), ('H', 10), ('Qty', 9), ('Unit', 9),
        ('Rate', 14), ('Amount', 16), ('GST %', 8), ('GST Amount', 14),
        ('Total', 16),
    ]
    for index, (_, width) in enumerate(columns, start=1):
        ws.column_dimensions[get_column_letter(index)].width = width

    last_column = get_column_letter(len(columns))

    def merged(row, text, *, size=11, bold=True, colour='1A1A2E'):
        ws.merge_cells(f'A{row}:{last_column}{row}')
        cell = ws.cell(row=row, column=1, value=text)
        cell.font = Font(bold=bold, size=size, color=colour)
        cell.alignment = Alignment(horizontal='left', vertical='center')
        return cell

    merged(1, COMPANY, size=16, colour='C9A96E')
    merged(2, f'{COMPANY_TAGLINE} — {estimate.get_type_display()}', size=10,
           bold=False, colour='6B7280')

    ws['A4'] = 'Client';    ws['B4'] = project.client_name
    ws['A5'] = 'Phone';     ws['B5'] = project.client_phone
    ws['A6'] = 'Email';     ws['B6'] = project.client_email
    ws['E4'] = 'Project';   ws['F4'] = project.name
    ws['E5'] = 'Developer'; ws['F5'] = project.developer
    ws['E6'] = 'Unit'
    ws['F6'] = f'{project.unit_no} · {project.area}'
    ws['J4'] = 'Version';   ws['K4'] = estimate.version
    ws['J5'] = 'Status';    ws['K5'] = estimate.get_status_display()
    ws['J6'] = 'Date'
    ws['K6'] = estimate.created_at.strftime('%d %b %Y')
    for coordinate in ('A4', 'A5', 'A6', 'E4', 'E5', 'E6', 'J4', 'J5', 'J6'):
        ws[coordinate].font = Font(bold=True, size=9, color='6B7280')

    header_row = 8
    for index, (label, _) in enumerate(columns, start=1):
        cell = ws.cell(row=header_row, column=index, value=label)
        cell.font = Font(bold=True, size=9, color='FFFFFF')
        cell.fill = HEADER_FILL
        cell.border = BORDER
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws.freeze_panes = f'A{header_row + 1}'

    row = header_row + 1
    current_area = None
    index = 0

    for item in estimate.items.all():
        if item.area != current_area:
            current_area = item.area
            ws.merge_cells(f'A{row}:{last_column}{row}')
            cell = ws.cell(row=row, column=1, value=(current_area or 'General').upper())
            cell.font = Font(bold=True, size=9, color='C9A96E')
            cell.fill = AREA_FILL
            row += 1

        index += 1
        gst_amount = item.amount * item.gst_pct / Decimal('100')
        values = [
            index, item.area, item.item, item.description,
            item.length, item.breadth, item.height,
            float(item.qty), item.unit,
            float(item.rate), float(item.amount),
            float(item.gst_pct), float(gst_amount), float(item.amount + gst_amount),
        ]
        for column, value in enumerate(values, start=1):
            cell = ws.cell(row=row, column=column, value=value)
            cell.border = BORDER
            cell.font = Font(size=9)
            cell.alignment = Alignment(vertical='top', wrap_text=column == 4)
            if column in (10, 11, 13, 14):
                cell.number_format = MONEY
        row += 1

    if index == 0:
        ws.merge_cells(f'A{row}:{last_column}{row}')
        ws.cell(row=row, column=1, value='No line items on this estimate.')
        row += 1

    row += 1
    totals = [
        ('Subtotal', float(estimate.subtotal)),
        ('Discount', -float(estimate.total_discount)),
        ('Taxable Amount', float(estimate.taxable_amount)),
        ('GST', float(estimate.gst_total)),
        ('GRAND TOTAL', float(estimate.grand_total)),
    ]
    if not estimate.total_discount:
        totals = [t for t in totals if t[0] not in ('Discount', 'Taxable Amount')]

    for label, value in totals:
        is_grand = label == 'GRAND TOTAL'
        ws.merge_cells(f'A{row}:M{row}')
        label_cell = ws.cell(row=row, column=1, value=label)
        label_cell.alignment = Alignment(horizontal='right')
        label_cell.font = Font(bold=True, size=11 if is_grand else 9,
                               color='1A1A2E' if is_grand else '6B7280')

        value_cell = ws.cell(row=row, column=len(columns), value=value)
        value_cell.number_format = MONEY
        value_cell.font = Font(bold=True, size=11 if is_grand else 9)
        value_cell.border = BORDER
        if is_grand:
            label_cell.fill = TOTAL_FILL
            value_cell.fill = TOTAL_FILL
        row += 1

    # ── Payment schedule on its own sheet ──
    milestones = list(project.payment_milestones.all())
    if milestones:
        ps = wb.create_sheet('Payment Schedule')
        for index, (label, width) in enumerate(
            [('S.No', 7), ('Milestone', 40), ('Due Date', 14),
             ('Amount', 16), ('Status', 14), ('Mode', 14), ('Reference', 26)],
            start=1,
        ):
            ps.column_dimensions[get_column_letter(index)].width = width
            cell = ps.cell(row=1, column=index, value=label)
            cell.font = Font(bold=True, size=9, color='FFFFFF')
            cell.fill = HEADER_FILL
            cell.border = BORDER

        for n, milestone in enumerate(milestones, start=1):
            for column, value in enumerate([
                n, milestone.milestone, str(milestone.due_date),
                float(milestone.amount), milestone.get_status_display(),
                milestone.mode, milestone.reference,
            ], start=1):
                cell = ps.cell(row=n + 1, column=column, value=value)
                cell.border = BORDER
                cell.font = Font(size=9)
                if column == 4:
                    cell.number_format = MONEY

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.read()
