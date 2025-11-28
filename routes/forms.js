const express = require('express');
const router = express.Router();
const formsController = require('../controllers/formsController');

// Home page
router.get('/', formsController.home);

// List applications by type
router.get('/forms/:type', formsController.list);

// New application form
router.get('/forms/:type/new', formsController.newForm);

// Edit application form
router.get('/forms/:type/:id/edit', formsController.editForm);

// Create new application
router.post('/forms/:type', formsController.create);

// Update existing application
router.post('/forms/:type/:id', formsController.update);

// Export application as PDF
router.get('/forms/:type/:id/pdf', formsController.exportPDF);

module.exports = router;
