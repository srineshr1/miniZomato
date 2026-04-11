import socketio

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
connected_partners: dict[str, int] = {}