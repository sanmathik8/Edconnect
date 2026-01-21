import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import core.routing

django_asgi_app = get_asgi_application()

from channels.security.websocket import AllowedHostsOriginValidator

application = ProtocolTypeRouter({
	"http": django_asgi_app,
	"websocket": AuthMiddlewareStack(
        URLRouter(
            core.routing.websocket_urlpatterns
        )
    ),
})
