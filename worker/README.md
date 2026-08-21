# Worker Fleet Service
Autonomous worker engine that polls queues with SELECT FOR UPDATE SKIP LOCKED, executes jobs concurrently, emits heartbeats, and handles graceful shutdown.
