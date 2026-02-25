const { prisma } = require('../prismaClient');
const pdfService = require('../services/pdfService');

// Valid form types
const VALID_TYPES = ['rejoining', 'leave-expats', 'leave-omani'];

// Type mapping for database (convert hyphen to underscore)
const normalizeType = (type) => {
  if (type === 'leave-expats') return 'leave_expats';
  if (type === 'leave-omani') return 'leave_omani';
  return type;
};

// Display name mapping
const getDisplayName = (type) => {
  const names = {
    'rejoining': 'Re-Joining Form',
    'leave-expats': 'Leave Application - Expats',
    'leave-omani': 'Leave Application - Omani'
  };
  return names[type] || type;
};

// Validate signature size (limit to 500KB base64)
const validateSignature = (signature) => {
  if (!signature) return null;

  // Check if it's a valid data URI
  if (!signature.startsWith('data:image/')) {
    return 'Invalid signature format';
  }

  // Check size (base64 length ≈ file size * 1.33)
  const maxSize = 500 * 1024; // 500KB
  if (signature.length > maxSize) {
    return 'Signature file is too large (max 500KB)';
  }

  return null;
};

// Validate and sanitize signature field
const processSignature = (signature, fieldName, errors) => {
  const error = validateSignature(signature);
  if (error) {
    errors[fieldName] = error;
    return '';
  }
  return signature || '';
};

// Home page
exports.home = (req, res) => {
  res.render('home', {
    title: 'TES Public Forms',
    csrfToken: req.csrfToken()
  });
};

// List applications by type
exports.list = async (req, res) => {
  try {
    const { type } = req.params;

    if (!VALID_TYPES.includes(type)) {
      return res.status(404).render('404', { title: 'Form Type Not Found' });
    }

    const dbType = normalizeType(type);
    const { search, from, to } = req.query;

    // Build where clause with JSONB queries
    const whereClause = {
      type: dbType,
    };

    const applications = await prisma.application.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    // PostgreSQL returns native JSON objects, no parsing needed
    let filteredApplications = applications;

    if (search) {
      filteredApplications = filteredApplications.filter(app => {
        const searchLower = search.toLowerCase();
        return (
          (app.data.name && app.data.name.toLowerCase().includes(searchLower)) ||
          (app.data.employeeName && app.data.employeeName.toLowerCase().includes(searchLower)) ||
          (app.data.employeeId && app.data.employeeId.toLowerCase().includes(searchLower)) ||
          (app.data.wrokId && app.data.wrokId.toLowerCase().includes(searchLower))
        );
      });
    }

    if (from) {
      const fromDate = new Date(from);
      filteredApplications = filteredApplications.filter(app =>
        new Date(app.createdAt) >= fromDate
      );
    }

    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      filteredApplications = filteredApplications.filter(app =>
        new Date(app.createdAt) <= toDate
      );
    }

    res.render('forms/list', {
      title: `${getDisplayName(type)} - Applications`,
      type,
      displayName: getDisplayName(type),
      applications: filteredApplications,
      filters: { search, from, to },
      exportError: req.query.exportError === '1',
      csrfToken: req.csrfToken()
    })
  } catch (error) {
    console.error('Error listing applications:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load applications',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

// New application form
exports.newForm = (req, res) => {
  const { type } = req.params;

  if (!VALID_TYPES.includes(type)) {
    return res.status(404).render('404', { title: 'Form Type Not Found' });
  }

  res.render('forms/new', {
    title: `New ${getDisplayName(type)}`,
    type,
    displayName: getDisplayName(type),
    csrfToken: req.csrfToken(),
    errors: {},
    formData: {},
    strictRequired: false
  });
};

// Edit application form
exports.editForm = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!VALID_TYPES.includes(type)) {
      return res.status(404).render('404', { title: 'Form Type Not Found' });
    }

    const dbType = normalizeType(type);
    const application = await prisma.application.findUnique({
      where: { id }
    });

    if (!application || application.type !== dbType) {
      return res.status(404).render('404', { title: 'Application Not Found' });
    }

    // PostgreSQL returns native JSON objects
    const parsedData = application.data;

    res.render('forms/edit', {
      title: `Edit ${getDisplayName(type)}`,
      type,
      displayName: getDisplayName(type),
      application,
      csrfToken: req.csrfToken(),
      errors: {},
      formData: parsedData,
      strictRequired: false,
      exportError: req.query.exportError === '1'
    });
  } catch (error) {
    console.error('Error loading application:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load application',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

// Create new application
exports.create = async (req, res) => {
  try {
    const { type } = req.params;

    if (!VALID_TYPES.includes(type)) {
      return res.status(404).render('404', { title: 'Form Type Not Found' });
    }

    const dbType = normalizeType(type);

    // Validate and sanitize form data
    const { action, ...formData } = req.body;
    const { errors, validatedData } = validateFormData(type, formData, { strict: action === 'export' });

    if (Object.keys(errors).length > 0) {
      return res.render('forms/new', {
        title: `New ${getDisplayName(type)}`,
        type,
        displayName: getDisplayName(type),
        csrfToken: req.csrfToken(),
        errors,
        formData,
        strictRequired: action === 'export'
      });
    }

    // Create application
    const application = await prisma.application.create({
      data: {
        type: dbType,
        data: validatedData
      }
    });

    // Check if user wants to export PDF immediately
    if (action === 'export') {
      return res.redirect(`/forms/${type}/${application.id}/pdf`);
    }

    res.redirect(`/forms/${type}`);
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to create application',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

// Update existing application
exports.update = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!VALID_TYPES.includes(type)) {
      return res.status(404).render('404', { title: 'Form Type Not Found' });
    }

    const dbType = normalizeType(type);

    // Check if application exists
    const existing = await prisma.application.findUnique({
      where: { id }
    });

    if (!existing || existing.type !== dbType) {
      return res.status(404).render('404', { title: 'Application Not Found' });
    }

    // Validate and sanitize form data
    const { action, ...formData } = req.body;
    const { errors, validatedData } = validateFormData(type, formData, { strict: action === 'export' });

    if (Object.keys(errors).length > 0) {
      return res.render('forms/edit', {
        title: `Edit ${getDisplayName(type)}`,
        type,
        displayName: getDisplayName(type),
        application: existing,
        csrfToken: req.csrfToken(),
        errors,
        formData,
        strictRequired: action === 'export'
      });
    }

    // Update application
    await prisma.application.update({
      where: { id },
      data: {
        data: validatedData
      }
    });

    // Check if user wants to export PDF immediately
    if (action === 'export') {
      return res.redirect(`/forms/${type}/${id}/pdf`);
    }

    res.redirect(`/forms/${type}`);
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to update application',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

// Export application as PDF
exports.exportPDF = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!VALID_TYPES.includes(type)) {
      return res.status(404).send('Form type not found');
    }

    const dbType = normalizeType(type);
    const application = await prisma.application.findUnique({
      where: { id }
    });

    if (!application || application.type !== dbType) {
      return res.status(404).send('Application not found');
    }

    // PostgreSQL returns native JSON objects
    const parsedData = application.data;

    // Validate strictly before exporting; if missing, redirect to edit with popup
    const { errors } = validateFormData(type, parsedData, { strict: true });
    if (Object.keys(errors).length > 0) {
      // Redirect back to list with an error flag so the UI can show a toast
      return res.redirect(`/forms/${type}?exportError=1`);
    }

    // Determine display name for filename
    function getDisplayNameForFile(formType, data) {
      let name = '';
      if (formType === 'rejoining') {
        name = data.name || '';
      } else {
        // leave-expats, leave-omani
        name = data.employeeName || '';
      }
      // Fallback to ID if no name
      if (!name || name.trim() === '') {
        name = id;
      }
      // Sanitize filename: remove illegal characters
      name = name.replace(/[^a-zA-Z0-9 _.-]/g, '').trim();
      // Limit length
      if (name.length > 80) name = name.slice(0, 80);
      return name || id;
    }
    const displayNameForFile = getDisplayNameForFile(type, parsedData);

    // Generate PDF
    const pdfBuffer = await pdfService.generatePDF(type, parsedData);

    // Set a cookie so the client knows the download has started (used to dismiss loading overlay)
    const token = req.query.pdfToken || '';
    if (token) {
      res.cookie('pdf_ready_' + token, '1', { maxAge: 30000, httpOnly: false });
    }

    // Set response headers for PDF download (type - name)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type} - ${displayNameForFile}.pdf"`);
    res.setHeader('Content-Length', Buffer.byteLength(pdfBuffer));
    res.end(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Failed to generate PDF');
  }
};

// Validation helper
function validateFormData(type, formData, options = {}) {
  const strict = options.strict === true;
  const errors = {};
  const validatedData = {};

  if (type === 'rejoining') {
    // Required fields
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Name is required';
    } else {
      validatedData.name = formData.name.trim();
    }

    if (!formData.wrokId || formData.wrokId.trim() === '') {
      errors.wrokId = 'Work ID is required';
    } else {
      validatedData.wrokId = formData.wrokId.trim();
    }

    // Optional fields (strict: require all except signatures)
    validatedData.mobileNo = formData.mobileNo?.trim() || '';
    validatedData.designation = formData.designation?.trim() || '';
    validatedData.leaveType = formData.leaveType?.trim() || '';
    validatedData.dateOfLeaving = formData.dateOfLeaving || '';
    validatedData.dateOfJoining = formData.dateOfJoining || '';
    validatedData.totalLeave = formData.totalLeave ? parseInt(formData.totalLeave) : 0;
    validatedData.allowedLeave = formData.allowedLeave ? parseInt(formData.allowedLeave) : 0;
    validatedData.extraLeave = formData.extraLeave ? parseInt(formData.extraLeave) : 0;
    validatedData.passportNo = formData.passportNo?.trim() || '';
    validatedData.passportHandedOver = formData.passportHandedOver?.trim() || '';

    if (strict) {
      if (!validatedData.mobileNo) errors.mobileNo = 'Mobile Number is required';
      if (!validatedData.designation) errors.designation = 'Designation is required';
      if (!validatedData.leaveType) errors.leaveType = 'Leave Type is required';
      if (!validatedData.dateOfLeaving) errors.dateOfLeaving = 'Date of Leaving is required';
      if (!validatedData.dateOfJoining) errors.dateOfJoining = 'Date of Joining is required';
      if (!validatedData.totalLeave || validatedData.totalLeave <= 0) errors.totalLeave = 'Total Leave is required';
      if (validatedData.allowedLeave < 0) errors.allowedLeave = 'Allowed Leave must be 0 or more';
      if (validatedData.extraLeave < 0) errors.extraLeave = 'Extra Leave must be 0 or more';
      if (!validatedData.passportNo) errors.passportNo = 'Passport No is required';
      if (!validatedData.passportHandedOver) errors.passportHandedOver = 'Passport Handed Over is required';
    }
    // Signatures (with size validation)
    validatedData.employeeSignature = processSignature(formData.employeeSignature, 'employeeSignature', errors);
    validatedData.employeeSignatureDate = formData.employeeSignatureDate || '';
    validatedData.managerSignature = processSignature(formData.managerSignature, 'managerSignature', errors);
    validatedData.managerSignatureDate = formData.managerSignatureDate || '';
    validatedData.hrSignature = processSignature(formData.hrSignature, 'hrSignature', errors);
    validatedData.hrSignatureDate = formData.hrSignatureDate || '';
  }
  else if (type === 'leave-expats') {
    // Required fields
    if (!formData.employeeName || formData.employeeName.trim() === '') {
      errors.employeeName = 'Employee name is required';
    } else {
      validatedData.employeeName = formData.employeeName.trim();
    }

    if (!formData.employeeId || formData.employeeId.trim() === '') {
      errors.employeeId = 'Employee ID is required';
    } else {
      validatedData.employeeId = formData.employeeId.trim();
    }

    // Optional fields
    validatedData.formDate = formData.formDate || '';
    validatedData.position = formData.position?.trim() || '';
    validatedData.site = formData.site?.trim() || '';
    validatedData.mobileNo = formData.mobileNo?.trim() || '';
    validatedData.leaveType = formData.leaveType || '';
    validatedData.commenceLeave = formData.commenceLeave || '';
    validatedData.totalDays = formData.totalDays ? parseInt(formData.totalDays) : 0;
    validatedData.lastDayLeave = formData.lastDayLeave || '';
    validatedData.airportName = formData.airportName?.trim() || '';
    // New radio fields
    validatedData.paymentOption = formData.paymentOption || '';
    validatedData.ticketOption = formData.ticketOption || '';

    if (strict) {
      if (!validatedData.formDate) errors.formDate = 'Form Date is required';
      if (!validatedData.position) errors.position = 'Position is required';
      if (!validatedData.site) errors.site = 'Site is required';
      if (!validatedData.mobileNo) errors.mobileNo = 'Mobile Number is required';
      if (!validatedData.leaveType) errors.leaveType = 'Leave Type is required';
      if (!validatedData.commenceLeave) errors.commenceLeave = 'Commence Leave is required';
      if (!validatedData.totalDays || validatedData.totalDays <= 0) errors.totalDays = 'Total Days is required';
      if (!validatedData.lastDayLeave) errors.lastDayLeave = 'Last Day of Leave is required';
      if (!validatedData.airportName) errors.airportName = 'Airport Name is required';
      if (!validatedData.paymentOption) errors.paymentOption = 'Payment Option is required';
      if (!validatedData.ticketOption) errors.ticketOption = 'Ticket Option is required';
    }
    // Signatures (with size validation)
    validatedData.employeeSignature = processSignature(formData.employeeSignature, 'employeeSignature', errors);
    validatedData.employeeSignatureDate = formData.employeeSignatureDate || '';
    validatedData.managerSignature = processSignature(formData.managerSignature, 'managerSignature', errors);
    validatedData.managerSignatureDate = formData.managerSignatureDate || '';
    validatedData.hrSignature = processSignature(formData.hrSignature, 'hrSignature', errors);
    validatedData.hrSignatureDate = formData.hrSignatureDate || '';
  }
  else if (type === 'leave-omani') {
    // Required fields
    if (!formData.employeeName || formData.employeeName.trim() === '') {
      errors.employeeName = 'Employee name is required';
    } else {
      validatedData.employeeName = formData.employeeName.trim();
    }

    if (!formData.employeeId || formData.employeeId.trim() === '') {
      errors.employeeId = 'Employee ID is required';
    } else {
      validatedData.employeeId = formData.employeeId.trim();
    }

    // Optional fields
    validatedData.formDate = formData.formDate || '';
    validatedData.position = formData.position?.trim() || '';
    validatedData.site = formData.site?.trim() || '';
    validatedData.mobileNo = formData.mobileNo?.trim() || '';
    validatedData.leaveType = formData.leaveType || '';
    validatedData.commenceLeave = formData.commenceLeave || '';
    validatedData.totalDays = formData.totalDays ? parseInt(formData.totalDays) : 0;
    validatedData.lastDayLeave = formData.lastDayLeave || '';

    if (strict) {
      if (!validatedData.formDate) errors.formDate = 'Form Date is required';
      if (!validatedData.position) errors.position = 'Position is required';
      if (!validatedData.site) errors.site = 'Site is required';
      if (!validatedData.mobileNo) errors.mobileNo = 'Mobile Number is required';
      if (!validatedData.leaveType) errors.leaveType = 'Leave Type is required';
      if (!validatedData.commenceLeave) errors.commenceLeave = 'Commence Leave is required';
      if (!validatedData.totalDays || validatedData.totalDays <= 0) errors.totalDays = 'Total Days is required';
      if (!validatedData.lastDayLeave) errors.lastDayLeave = 'Last Day of Leave is required';
    }
    // Signatures (with size validation)
    validatedData.employeeSignature = processSignature(formData.employeeSignature, 'employeeSignature', errors);
    validatedData.employeeSignatureDate = formData.employeeSignatureDate || '';
    validatedData.managerSignature = processSignature(formData.managerSignature, 'managerSignature', errors);
    validatedData.managerSignatureDate = formData.managerSignatureDate || '';
    validatedData.hrSignature = processSignature(formData.hrSignature, 'hrSignature', errors);
    validatedData.hrSignatureDate = formData.hrSignatureDate || '';
  }

  return { errors, validatedData };
}
