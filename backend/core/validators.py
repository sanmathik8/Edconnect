import logging
import os
import mimetypes
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from PIL import Image
from io import BytesIO

logger = logging.getLogger(__name__)


# File size limits (in bytes)
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024  # 50MB
MAX_AUDIO_SIZE = 10 * 1024 * 1024  # 10MB
MAX_DOCUMENT_SIZE = 25 * 1024 * 1024  # 25MB

# Allowed file types
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4']
ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 
                          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          'text/plain']


def sanitize_filename(filename):
    """Remove dangerous characters from filename"""
    # Keep only alphanumeric, dots, dashes, underscores
    import re
    name, ext = os.path.splitext(filename)
    name = re.sub(r'[^a-zA-Z0-9_-]', '_', name)
    return f"{name}{ext}"


def get_safe_mime_type(file):
    """Get MIME type from content_type if available (more secure), else guess from filename"""
    if hasattr(file, 'content_type') and file.content_type:
        return file.content_type
    if hasattr(file, 'name') and file.name:
        return mimetypes.guess_type(file.name)[0]
    return None


def validate_file_size(file, max_size, file_type_name):
    """Validate file size"""
    if file.size > max_size:
        max_mb = max_size / (1024 * 1024)
        raise ValidationError(f'{file_type_name} file too large. Maximum size is {max_mb}MB.')


def validate_image_file(file):
    """Validate image file type and size"""
    # Check MIME type
    mime_type = get_safe_mime_type(file)
    if mime_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationError(f'Invalid image type. Allowed types: JPEG, PNG, GIF, WebP')
    
    # Check file size
    validate_file_size(file, MAX_IMAGE_SIZE, 'Image')
    
    # Verify it's actually an image using Pillow
    try:
        img = Image.open(file)
        img.verify()
        
        # Check dimensions
        if hasattr(img, 'width') and hasattr(img, 'height'):
             if img.width > 8000 or img.height > 8000:
                 raise ValidationError("Image dimensions too large")
                 
        file.seek(0)  # Reset file pointer
    except Exception as e:
        if isinstance(e, ValidationError):
            raise e
        raise ValidationError('Invalid or corrupted image file')
    
    return True


def validate_video_file(file):
    """Validate video file type and size"""
    mime_type = get_safe_mime_type(file)
    if mime_type not in ALLOWED_VIDEO_TYPES:
        raise ValidationError(f'Invalid video type. Allowed types: MP4, WebM, MOV, AVI')
    
    validate_file_size(file, MAX_VIDEO_SIZE, 'Video')
    return True


def validate_audio_file(file):
    """Validate audio file type and size"""
    mime_type = get_safe_mime_type(file)
    if mime_type not in ALLOWED_AUDIO_TYPES:
        raise ValidationError(f'Invalid audio type. Allowed types: MP3, WAV, OGG, WebM')
    
    validate_file_size(file, MAX_AUDIO_SIZE, 'Audio')
    return True


def validate_document_file(file):
    """Validate document file type and size"""
    mime_type = get_safe_mime_type(file)
    if mime_type not in ALLOWED_DOCUMENT_TYPES:
        raise ValidationError(f'Invalid document type. Allowed types: PDF, DOC, DOCX, TXT')
    
    validate_file_size(file, MAX_DOCUMENT_SIZE, 'Document')
    return True


def generate_thumbnail(image_file, size=(300, 300)):
    """Generate thumbnail for image (FREE - uses Pillow)"""
    try:
        img = Image.open(image_file)
        
        # Convert RGBA to RGB if needed
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        # Create thumbnail
        img.thumbnail(size, Image.Resampling.LANCZOS)
        
        # Save to BytesIO
        thumb_io = BytesIO()
        img.save(thumb_io, format='JPEG', quality=85)
        thumb_io.seek(0)
        
        return thumb_io
    except Exception as e:
        logger.warning(f"Thumbnail generation failed: {e}")
        return None


def get_file_type(filename):
    """Determine file type from filename (Legacy helper)"""
    mime_type = mimetypes.guess_type(filename)[0]
    
    if mime_type in ALLOWED_IMAGE_TYPES:
        return 'image'
    elif mime_type in ALLOWED_VIDEO_TYPES:
        return 'video'
    elif mime_type in ALLOWED_AUDIO_TYPES:
        return 'audio'
    elif mime_type in ALLOWED_DOCUMENT_TYPES:
        return 'document'
    else:
        return None


def validate_chat_attachment(file):
    """Main validation function for chat attachments"""
    # Use legacy filename check for initial dispatch, but validators use safe check
    file_type = get_file_type(file.name)
    
    if not file_type:
        raise ValidationError('Unsupported file type')
    
    # Validate based on type
    if file_type == 'image':
        validate_image_file(file)
    elif file_type == 'video':
        validate_video_file(file)
    elif file_type == 'audio':
        validate_audio_file(file)
    elif file_type == 'document':
        validate_document_file(file)
    
    file.seek(0)
    return file_type
