const { PrismaClient } = require('@prisma/client');
const pdfService = require('../services/pdfService');

const prisma = new PrismaClient();

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

    // Parse JSON data for each application
    const parsedApplications = applications.map(app => ({
      ...app,
      data: typeof app.data === 'string' ? JSON.parse(app.data) : app.data
    }));

    // Filter in memory for search and dates since SQLite doesn't support JSON queries
    let filteredApplications = parsedApplications;
    
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
      csrfToken: req.csrfToken()
    });
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
    formData: {}
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

    // Parse JSON data
    const parsedData = typeof application.data === 'string' ? JSON.parse(application.data) : application.data;

    res.render('forms/edit', {
      title: `Edit ${getDisplayName(type)}`,
      type,
      displayName: getDisplayName(type),
      application,
      csrfToken: req.csrfToken(),
      errors: {},
      formData: parsedData
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
    const { errors, validatedData } = validateFormData(type, formData);

    if (Object.keys(errors).length > 0) {
      return res.render('forms/new', {
        title: `New ${getDisplayName(type)}`,
        type,
        displayName: getDisplayName(type),
        csrfToken: req.csrfToken(),
        errors,
        formData
      });
    }

    // Create application
    const application = await prisma.application.create({
      data: {
        type: dbType,
        data: JSON.stringify(validatedData)
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
    const { errors, validatedData } = validateFormData(type, formData);

    if (Object.keys(errors).length > 0) {
      return res.render('forms/edit', {
        title: `Edit ${getDisplayName(type)}`,
        type,
        displayName: getDisplayName(type),
        application: existing,
        csrfToken: req.csrfToken(),
        errors,
        formData
      });
    }

    // Update application
    await prisma.application.update({
      where: { id },
      data: {
        data: JSON.stringify(validatedData)
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

    // Parse JSON data
    const parsedData = typeof application.data === 'string' ? JSON.parse(application.data) : application.data;

    // Generate PDF
    const pdfBuffer = await pdfService.generatePDF(type, parsedData);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Failed to generate PDF');
  }
};

// Validation helper
function validateFormData(type, formData) {
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

    // Optional fields
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
    // Signatures
    validatedData.employeeSignature = formData.employeeSignature || '';
    validatedData.employeeSignatureDate = formData.employeeSignatureDate || '';
    validatedData.managerSignature = formData.managerSignature || '';
    validatedData.managerSignatureDate = formData.managerSignatureDate || '';
    validatedData.hrSignature = formData.hrSignature || '';
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
    validatedData.paymentAdvance = formData.paymentAdvance === 'true' || formData.paymentAdvance === true;
    validatedData.paymentAfterReturn = formData.paymentAfterReturn === 'true' || formData.paymentAfterReturn === true;
    validatedData.issueMyTicket = formData.issueMyTicket === 'true' || formData.issueMyTicket === true;
    validatedData.issueTicketFamily = formData.issueTicketFamily === 'true' || formData.issueTicketFamily === true;
    validatedData.wantCompensation = formData.wantCompensation === 'true' || formData.wantCompensation === true;
    // Signatures
    validatedData.employeeSignature = formData.employeeSignature || '';
    validatedData.employeeSignatureDate = formData.employeeSignatureDate || '';
    validatedData.managerSignature = formData.managerSignature || '';
    validatedData.managerSignatureDate = formData.managerSignatureDate || '';
    validatedData.hrSignature = formData.hrSignature || '';
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
    // Signatures
    validatedData.employeeSignature = formData.employeeSignature || '';
    validatedData.employeeSignatureDate = formData.employeeSignatureDate || '';
    validatedData.managerSignature = formData.managerSignature || '';
    validatedData.managerSignatureDate = formData.managerSignatureDate || '';
    validatedData.hrSignature = formData.hrSignature || '';
    validatedData.hrSignatureDate = formData.hrSignatureDate || '';
  }

  return { errors, validatedData };
}
