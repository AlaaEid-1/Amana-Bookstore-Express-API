const express = require('express');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const app = express();

// Create a write stream for logging
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'logging', 'log.txt'), { flags: 'a' });

// Use Morgan middleware for logging
app.use(morgan('combined', { stream: accessLogStream }));

app.use(express.json());
const port = 3000;

// Hardcoded secret for authentication (designate users by sharing this key)
const API_SECRET = 'mySecretKey123';

// Middleware to check authentication via x-api-key header
function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }
  next();
}
app.get('/', (req, res) => {
  res.send("Hello I'm Alaa Eid");
});

app.get('/books', (req, res) => {
  try {
    const booksData = fs.readFileSync(path.join(__dirname, 'data', 'books.json'), 'utf8');
    const books = JSON.parse(booksData);
    const { startDate, endDate } = req.query;
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if ((startDate && isNaN(start.getTime())) || (endDate && isNaN(end.getTime()))) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      }

      const filteredBooks = books.books.filter(book => {
        const pubDate = new Date(book.datePublished);
        const afterStart = !start || pubDate >= start;
        const beforeEnd = !end || pubDate <= end;
        return afterStart && beforeEnd;
      });

      res.json(filteredBooks);
    } else {
      res.json(books.books);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to load books data' });
  }
});

app.post('/books', authMiddleware, (req, res) => {
  try {
    const booksData = fs.readFileSync(path.join(__dirname, 'data', 'books.json'), 'utf8');
    const books = JSON.parse(booksData);

    const newBook = req.body;

    // Basic validation
    if (!newBook.title || !newBook.author) {
      return res.status(400).json({ error: 'Title and author are required' });
    }

    // Generate new id
    const maxId = books.books.length > 0 ? Math.max(...books.books.map(b => parseInt(b.id))) : 0;
    newBook.id = (maxId + 1).toString();

    // Add default values if not provided
    newBook.rating = newBook.rating || 0;
    newBook.reviewCount = newBook.reviewCount || 0;
    newBook.inStock = newBook.inStock !== undefined ? newBook.inStock : true;
    newBook.featured = newBook.featured !== undefined ? newBook.featured : false;

    books.books.push(newBook);

    fs.writeFileSync(path.join(__dirname, 'data', 'books.json'), JSON.stringify(books, null, 2));

    res.status(201).json(newBook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add book' });
  }
});

app.get('/books/:id', (req, res) => {
  try {
    const booksData = fs.readFileSync(path.join(__dirname, 'data', 'books.json'), 'utf8');
    const books = JSON.parse(booksData);
    const book = books.books.find(b => b.id === req.params.id);
    if (book) {
      res.json(book);
    } else {
      res.status(404).json({ error: 'Book not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to load books data' });
  }
});

app.get('/books/:id/reviews', (req, res) => {
  try {
    const reviewsData = fs.readFileSync(path.join(__dirname, 'data', 'reviews.json'), 'utf8');
    const reviews = JSON.parse(reviewsData);
    const bookReviews = reviews.reviews.filter(review => review.bookId === req.params.id);
    res.json(bookReviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load reviews data' });
  }
});

app.get('/top-rated-books', (req, res) => {
  try {
    const booksData = fs.readFileSync(path.join(__dirname, 'data', 'books.json'), 'utf8');
    const books = JSON.parse(booksData);
    const topBooks = books.books
      .map(book => ({ ...book, score: book.rating * book.reviewCount }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    res.json(topBooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load books data' });
  }
});

app.get('/featured-books', (req, res) => {
  try {
    const booksData = fs.readFileSync(path.join(__dirname, 'data', 'books.json'), 'utf8');
    const books = JSON.parse(booksData);
    const featuredBooks = books.books.filter(book => book.featured === true);
    res.json(featuredBooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load books data' });
  }
});

app.post('/reviews', authMiddleware, (req, res) => {
  try {
    const reviewsData = fs.readFileSync(path.join(__dirname, 'data', 'reviews.json'), 'utf8');
    const reviews = JSON.parse(reviewsData);
    const booksData = fs.readFileSync(path.join(__dirname, 'data', 'books.json'), 'utf8');
    const books = JSON.parse(booksData);

    const newReview = req.body;

    // Validate required fields
    if (!newReview.bookId || !newReview.author || !newReview.rating || !newReview.title || !newReview.comment) {
      return res.status(400).json({ error: 'bookId, author, rating, title, and comment are required' });
    }

    // Validate rating is between 1 and 5
    if (newReview.rating < 1 || newReview.rating > 5 || !Number.isInteger(newReview.rating)) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    // Check if book exists
    const bookExists = books.books.some(book => book.id === newReview.bookId);
    if (!bookExists) {
      return res.status(400).json({ error: 'Invalid bookId: book does not exist' });
    }

    // Generate new id
    const maxId = reviews.reviews.length > 0 ? Math.max(...reviews.reviews.map(r => parseInt(r.id.split('-')[1]))) : 0;
    newReview.id = `review-${maxId + 1}`;

    // Add timestamp
    newReview.timestamp = new Date().toISOString();

    // Set verified default to false if not provided
    newReview.verified = newReview.verified !== undefined ? newReview.verified : false;

    reviews.reviews.push(newReview);

    fs.writeFileSync(path.join(__dirname, 'data', 'reviews.json'), JSON.stringify(reviews, null, 2));

    res.status(201).json(newReview);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add review' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
