const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Use EJS and point views to the `test` folder which contains `leave_omani.ejs`.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'test'));

// Serve the `test` folder at /images so `Picture.png` is available as /images/Picture.png
app.use('/images', express.static(path.join(__dirname, 'test')));

// Simple preview route that provides sample data to the template
app.get('/preview', (req, res) => {
  const sampleData = {
    employeeName: 'Ahmed Al Zadjali',
    employeeId: 'EMP-12345',
    formDate: '2025-11-22',
    position: 'Technician',
    site: 'Al Khuwair',
    mobileNo: '+968 9911 2233',
    leaveType: 'annual',
    doctorsCertificate: true,
    otherDocs: 'Passport copy attached',
    commenceLeave: '2025-12-01',
    totalDays: '30',
    lastDayLeave: '2025-12-30'
  };

  res.render('leave_omani', { data: sampleData });
});

// Preview route for Expats form
app.get('/preview-expats', (req, res) => {
  const sampleData = {
    employeeName: 'GIRDHARI SINGH YADEV',
    employeeId: 'Y9552486',
    formDate: '23.Sep.2025',
    position: 'Operator',
    site: 'Wadi Ronob (Alwusta Al Jazer)',
    mobileNo: '71907250',
    leaveType: 'annual',
    commenceLeave: '10.Oct.2025',
    totalDays: '60 Days',
    lastDayLeave: '09.Dec.2025',
    airportName: 'Varanasi Airport (India)',
    paymentAdvance: true,
    paymentAfterReturn: false,
    issueMyTicket: false,
    issueTicketFamily: true,
    wantCompensation: false
  };

  res.render('leave_expats', { data: sampleData });
});

// Preview route for Re-Joining form
app.get('/preview-rejoining', (req, res) => {
  const sampleData = {
    name: 'MOHAMMAD NOMAN',
    wrokId: '106040645',
    mobileNo: '98917978',
    designation: 'HELPER',
    leaveType: 'Annual',
    dateOfLeaving: '22.Mar.2025',
    dateOfJoining: '28.Jun.2025',
    totalLeave: '96 Days',
    allowedLeave: '60',
    extraLeave: '36',
    passportNo: 'EK0093936',
    passportHandedOver: 'Received at Haima office'
  };

  res.render('rejoining', { data: sampleData });
});

app.get('/', (req, res) => res.redirect('/preview'));

app.listen(port, () => {
  console.log(`TES forms preview server listening on http://localhost:${port}`);
  console.log('Open http://localhost:' + port + '/preview to view the Omani template');
  console.log('Open http://localhost:' + port + '/preview-expats to view the Expats template');
  console.log('Open http://localhost:' + port + '/preview-rejoining to view the Re-Joining template');
});