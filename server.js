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

app.get('/', (req, res) => res.redirect('/preview'));

app.listen(port, () => {
  console.log(`TES forms preview server listening on http://localhost:${port}`);
  console.log('Open http://localhost:' + port + '/preview to view the template');
});