require("dotenv").config();  
const express = require("express");
const session = require("express-session");
const flash = require("express-flash");
const bodyParser = require("body-parser");
const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/report');
const patientRoutes = require('./routes/patient');
const settingsRoutes = require('./routes/settings');
const path = require('path');
const feedbackRoutes = require('./routes/feedback');

const app = express();

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "default_secret";

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));    
app.use(flash());

app.use((req, res, next) => {
    res.locals.user = req.session.user || null; 
    next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Define routes
app.use(authRoutes);
app.use('/report', reportRoutes);
app.use('/patient', patientRoutes);
app.use('/settings', settingsRoutes);
app.use('/feedback', feedbackRoutes);

app.listen(PORT, () => {
    console.log("Server running on http://localhost:3000");
});