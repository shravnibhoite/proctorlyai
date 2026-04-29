import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DATA_DIR
from database.db import ExamSession, IncidentEvent

def generate_pdf_report(session: ExamSession, events: list[IncidentEvent]) -> str:
    """Generates a PDF report for a completed exam session."""
    filename = f"report_session_{session.id}.pdf"
    filepath = os.path.join(DATA_DIR, "reports", filename)
    
    doc = SimpleDocTemplate(filepath, pagesize=letter)
    styles = getSampleStyleSheet()
    Story = []

    # Title
    Story.append(Paragraph(f"Proctoring Report: Session #{session.id}", styles['Title']))
    Story.append(Spacer(1, 12))

    # Session Info
    username = session.user.username if session.user else "Unknown"
    full_name = session.user.full_name if session.user else "Unknown User"
    
    Story.append(Paragraph(f"<b>User:</b> {full_name} ({username})", styles['Normal']))
    Story.append(Paragraph(f"<b>Start Time:</b> {session.start_time}", styles['Normal']))
    Story.append(Paragraph(f"<b>End Time:</b> {session.end_time}", styles['Normal']))
    Story.append(Paragraph(f"<b>Status:</b> {session.status.upper()}", styles['Normal']))
    Story.append(Paragraph(f"<b>Final Risk Score:</b> {session.final_risk_score:.1f}/100", styles['Normal']))
    Story.append(Spacer(1, 24))

    # Events
    Story.append(Paragraph("Incident Events", styles['Heading2']))
    Story.append(Spacer(1, 12))

    if not events:
        Story.append(Paragraph("No suspicious events recorded.", styles['Normal']))
    else:
        for event in events:
            Story.append(Paragraph(f"<b>{event.timestamp} - {event.event_type}</b>", styles['Heading3']))
            Story.append(Paragraph(f"Severity: {event.severity:.1f} - Description: {event.description}", styles['Normal']))
            
            if event.screenshot_path and os.path.exists(event.screenshot_path):
                img = Image(event.screenshot_path, width=4*inch, height=3*inch)
                Story.append(img)
            
            Story.append(Spacer(1, 12))

    doc.build(Story)
    return filepath
