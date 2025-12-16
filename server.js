require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');

const formsRouter = require('./routes/forms');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// CSRF protection
const csrfProtection = csrf({ cookie: true });

// Rate limiting for write endpoints (10 requests per minute per IP)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to POST routes
app.use('/forms/*', (req, res, next) => {
  if (req.method === 'POST') {
    return limiter(req, res, next);
  }
  next();
});

// Routes
app.use('/', csrfProtection, formsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  // CSRF token errors
  if (err.code === 'EBADCSRFTOKEN') {
    res.status(403).render('error', {
      title: 'Invalid Request',
      message: 'Form submission invalid. Please try again.',
      error: {}
    });
    return;
  }

  console.error(err.stack);
  res.status(err.status || 500).render('error', {
    title: 'Error',
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Test database connection
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Check DATABASE_URL environment variable');
  }
});
