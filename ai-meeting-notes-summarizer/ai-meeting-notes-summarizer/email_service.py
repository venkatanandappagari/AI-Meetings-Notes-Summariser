import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email(recipients, subject, summary, custom_prompt):
    """
    Send email with meeting summary to specified recipients.
    
    Args:
        recipients (list): List of email addresses
        subject (str): Email subject
        summary (str): Meeting summary content
        custom_prompt (str): The custom prompt used for summarization
    
    Raises:
        Exception: If email sending fails
    """
    try:
        # Email configuration
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        email_username = os.environ.get('EMAIL_USERNAME')
        email_password = os.environ.get('EMAIL_PASSWORD')
        
        if not email_username or not email_password:
            raise Exception("Email credentials not configured. Please contact the administrator to set up email service.")
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = email_username
        msg['To'] = ', '.join(recipients)
        msg['Subject'] = subject
        
        # Email body
        body = f"""
Hello,

Please find the meeting summary below, generated with the following instructions: "{custom_prompt}"

--- MEETING SUMMARY ---

{summary}

--- END SUMMARY ---

This summary was generated using AI and may have been edited for clarity.

Best regards,
Meeting Notes Summarizer
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(email_username, email_password)
            server.send_message(msg)
        
        logging.info(f"Email sent successfully to {len(recipients)} recipients")
        
    except Exception as e:
        logging.error(f"Email sending failed: {str(e)}")
        raise Exception(f"Failed to send email: {str(e)}")
