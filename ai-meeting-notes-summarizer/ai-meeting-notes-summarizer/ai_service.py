import os
import logging
import google.generativeai as genai

# Initialize Gemini client
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

genai.configure(api_key=GEMINI_API_KEY)

def generate_summary(text, custom_prompt):
    """
    Generate a summary of the meeting notes using Gemini API with custom prompt.
    
    Args:
        text (str): The original meeting transcript/notes
        custom_prompt (str): Custom instruction for summarization
    
    Returns:
        str: Generated summary
    
    Raises:
        Exception: If API call fails
    """
    try:
        # Construct the full prompt
        full_prompt = f"""
        Please analyze the following meeting transcript and create a summary based on these specific instructions: "{custom_prompt}"

        Meeting Transcript:
        {text}

        Instructions: {custom_prompt}

        Please provide a well-structured summary that follows the given instructions.
        """
        
        # Initialize Gemini model
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Call Gemini API
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=2000,
                temperature=0.3,
            )
        )
        
        summary = response.text.strip()
        
        if not summary:
            raise Exception("AI generated empty summary")
        
        logging.info(f"Successfully generated summary of {len(summary)} characters")
        return summary
        
    except Exception as e:
        logging.error(f"Gemini API error: {str(e)}")
        raise Exception(f"Failed to generate AI summary: {str(e)}")
