import os
import logging
from flask import render_template, request, jsonify, flash, redirect, url_for
from werkzeug.utils import secure_filename
from app import app, db
from models import MeetingNote, EmailShare
from ai_service import generate_summary
from email_service import send_email
import PyPDF2
import io

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'txt', 'pdf'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(file):
    """Extract text content from PDF file."""
    try:
        # Reset file pointer to beginning
        file.seek(0)
        
        # Read PDF content
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file.read()))
        
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        if not text.strip():
            raise Exception("No readable text found in PDF")
            
        return text.strip()
        
    except Exception as e:
        logging.error(f"PDF extraction error: {str(e)}")
        raise Exception(f"Failed to extract text from PDF: {str(e)}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file selected'}), 400
        
        file = request.files['file']
        custom_prompt = request.form.get('custom_prompt', '').strip()
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not custom_prompt:
            return jsonify({'error': 'Custom prompt is required'}), 400
        
        if file and allowed_file(file.filename):
            # Read file content based on file type
            try:
                filename = file.filename.lower()
                if filename.endswith('.txt'):
                    content = file.read().decode('utf-8')
                elif filename.endswith('.pdf'):
                    content = extract_text_from_pdf(file)
                else:
                    return jsonify({'error': 'Unsupported file type'}), 400
            except UnicodeDecodeError:
                return jsonify({'error': 'File must be a valid UTF-8 text file'}), 400
            except Exception as e:
                logging.error(f"File processing error: {str(e)}")
                return jsonify({'error': 'Failed to process file. Please ensure it\'s a valid text or PDF file'}), 400
            
            if not content.strip():
                return jsonify({'error': 'File appears to be empty or contains no readable text'}), 400
            
            # Generate AI summary
            try:
                ai_summary = generate_summary(content, custom_prompt)
            except Exception as e:
                logging.error(f"AI summary generation failed: {str(e)}")
                return jsonify({'error': f'Failed to generate summary: {str(e)}'}), 500
            
            # Save to database
            meeting_note = MeetingNote(
                original_text=content,
                custom_prompt=custom_prompt,
                ai_summary=ai_summary
            )
            db.session.add(meeting_note)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'note_id': meeting_note.id,
                'summary': ai_summary
            })
        
        return jsonify({'error': 'Invalid file type. Only .txt and .pdf files are allowed'}), 400
        
    except Exception as e:
        logging.error(f"Upload error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

@app.route('/update_summary/<int:note_id>', methods=['POST'])
def update_summary(note_id):
    try:
        data = request.get_json()
        edited_summary = data.get('summary', '').strip()
        
        if not edited_summary:
            return jsonify({'error': 'Summary cannot be empty'}), 400
        
        meeting_note = MeetingNote.query.get_or_404(note_id)
        meeting_note.edited_summary = edited_summary
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Summary updated successfully'})
        
    except Exception as e:
        logging.error(f"Update summary error: {str(e)}")
        return jsonify({'error': 'Failed to update summary'}), 500

@app.route('/check_email_config', methods=['GET'])
def check_email_config():
    """Check if email credentials are configured."""
    email_username = os.environ.get('EMAIL_USERNAME')
    email_password = os.environ.get('EMAIL_PASSWORD')
    
    is_configured = bool(email_username and email_password)
    
    return jsonify({
        'configured': is_configured,
        'message': 'Email service is ready' if is_configured else 'Email credentials not configured'
    })

@app.route('/send_email/<int:note_id>', methods=['POST'])
def send_summary_email(note_id):
    try:
        # Check email configuration first
        email_username = os.environ.get('EMAIL_USERNAME')
        email_password = os.environ.get('EMAIL_PASSWORD')
        
        if not email_username or not email_password:
            return jsonify({
                'error': 'Email service is not configured. Please contact the administrator to set up email credentials.',
                'error_type': 'configuration'
            }), 400
        
        data = request.get_json()
        recipient_emails = data.get('emails', [])
        
        if not recipient_emails:
            return jsonify({'error': 'At least one email address is required'}), 400
        
        meeting_note = MeetingNote.query.get_or_404(note_id)
        
        # Use edited summary if available, otherwise use AI summary
        summary_to_send = meeting_note.edited_summary or meeting_note.ai_summary
        
        # Send email
        try:
            send_email(
                recipients=recipient_emails,
                subject='Meeting Summary',
                summary=summary_to_send,
                custom_prompt=meeting_note.custom_prompt
            )
        except Exception as e:
            error_message = str(e)
            logging.error(f"Email sending failed: {error_message}")
            
            # Provide user-friendly error messages
            if 'authentication' in error_message.lower() or 'password' in error_message.lower():
                user_message = 'Email authentication failed. Please check email credentials.'
            elif 'network' in error_message.lower() or 'connection' in error_message.lower():
                user_message = 'Network error. Please check your internet connection and try again.'
            elif 'invalid' in error_message.lower() and 'email' in error_message.lower():
                user_message = 'One or more email addresses appear to be invalid.'
            else:
                user_message = f'Email sending failed: {error_message}'
            
            return jsonify({
                'error': user_message,
                'error_type': 'sending'
            }), 500
        
        # Save email record
        email_share = EmailShare(
            meeting_note_id=note_id,
            recipient_emails=','.join(recipient_emails)
        )
        db.session.add(email_share)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Email sent successfully'})
        
    except Exception as e:
        logging.error(f"Send email error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred while sending email'}), 500

@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large. Maximum size is 16MB'}), 413

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Resource not found'}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error'}), 500
