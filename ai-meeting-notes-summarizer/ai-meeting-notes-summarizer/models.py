from app import db
from datetime import datetime

class MeetingNote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    original_text = db.Column(db.Text, nullable=False)
    custom_prompt = db.Column(db.Text, nullable=False)
    ai_summary = db.Column(db.Text, nullable=False)
    edited_summary = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<MeetingNote {self.id}>'

class EmailShare(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    meeting_note_id = db.Column(db.Integer, db.ForeignKey('meeting_note.id'), nullable=False)
    recipient_emails = db.Column(db.Text, nullable=False)
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    meeting_note = db.relationship('MeetingNote', backref=db.backref('email_shares', lazy=True))
    
    def __repr__(self):
        return f'<EmailShare {self.id}>'
