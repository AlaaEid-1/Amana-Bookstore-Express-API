# TODO for Authentication Restriction on POST Requests

- [x] Add authentication middleware function in server.js that checks 'x-api-key' header against hardcoded secret.
- [x] Apply authMiddleware to app.post('/books', ...) route.
- [x] Apply authMiddleware to app.post('/reviews', ...) route.
- [x] Test the implementation by running the server and verifying POST requests are restricted without the key.
