from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    Custom exception handler for standardized error responses.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    # If response is None, it means it's an unhandled exception (e.g. 500)
    if response is None:
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return Response({
            "error": "Internal Server Error",
            "detail": str(exc) # hiding this in prod would be better but for now it helps
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Customize the response format
    if isinstance(response.data, dict):
        # Convert standard DRF error format to our format
        custom_data = {
            "ok": False,
            "error": "Request failed"
        }
        
        if "detail" in response.data:
            custom_data["error"] = response.data["detail"]
        elif "non_field_errors" in response.data:
            custom_data["error"] = response.data["non_field_errors"][0]
        else:
            # Field errors
            custom_data["form_errors"] = response.data
            custom_data["error"] = "Validation failed"

        response.data = custom_data

    return response
