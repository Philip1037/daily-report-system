require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const docx = require('docx');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Database paths
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Initialize Supabase Client if env variables are set
const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
let supabase = null;
if (useSupabase) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  console.log('Supabase mode active.');
  console.log('Supabase URL configured as:', process.env.SUPABASE_URL);
} else {
  console.log('Local db.json mode active.');
}

// Helper to fetch image buffers for PDF / Docx generation (handles local files & remote URLs)
async function getImageBuffer(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) {
    try {
      const response = await fetch(imagePath);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (e) {
      console.error('Error fetching image URL:', e);
      return null;
    }
  } else {
    const cleanedPath = imagePath.replace(/^\//, '');
    const fullImagePath = path.join(__dirname, cleanedPath);
    if (fs.existsSync(fullImagePath)) {
      return fs.readFileSync(fullImagePath);
    }
    return null;
  }
}

// Ensure necessary directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initialize Database JSON file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  const defaultDb = {
    reports: [],
    departments: ['Engineering', 'Sales', 'HR', 'Marketing', 'Finance', 'Operations', 'Customer Support'],
    users: [
      { username: 'innovativesl', password: 'innovative1037', role: 'worker' },
      { username: 'admin', password: 'admin1037', role: 'management' }
    ]
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
} else {
  // Migrate existing database to support users list
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(data);
    if (!db.users) {
      db.users = [
        { username: 'innovativesl', password: 'innovative1037', role: 'worker' },
        { username: 'admin', password: 'admin1037', role: 'management' }
      ];
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
  } catch (error) {
    console.error('Error migrating database file:', error);
  }
}

// Database helper functions
function readDb() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file, resetting to defaults.', error);
    return { reports: [], departments: ['Engineering', 'Sales', 'HR', 'Marketing', 'Finance', 'Operations', 'Customer Support'] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing database file:', error);
  }
}

// HTML parsing helper functions for PDF and Word downloads

const parseHtmlToBlocks = (html) => {
  const blocks = [];
  const blockRegex = /<(p|li)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = blockRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const content = match[3];

    let align = 'left';
    if (attrs.includes('ql-align-center')) {
      align = 'center';
    } else if (attrs.includes('ql-align-right')) {
      align = 'right';
    } else if (attrs.includes('ql-align-justify')) {
      align = 'justify';
    }

    blocks.push({ type: tag, content, align });
  }
  // If no blocks were parsed (for old plain text reports), just wrap the whole thing in blocks
  if (blocks.length === 0 && html && html.trim() !== '') {
    html.split('\n').forEach(line => {
      blocks.push({ type: 'p', content: line, align: 'left' });
    });
  }
  return blocks;
};

const parseInlineRuns = (htmlContent) => {
  const runs = [];
  const tagRegex = /(<[^>]+>|[^<]+)/g;
  let match;
  
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;

  while ((match = tagRegex.exec(htmlContent)) !== null) {
    const chunk = match[0];
    if (chunk.startsWith('<')) {
      const tag = chunk.toLowerCase();
      if (tag.includes('strong') || tag.includes('b')) {
        isBold = !tag.startsWith('</');
      } else if (tag.includes('em') || tag.includes('i')) {
        isItalic = !tag.startsWith('</');
      } else if (tag.includes('u')) {
        isUnderline = !tag.startsWith('</');
      }
    } else {
      const text = chunk
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ');

      runs.push({
        text,
        bold: isBold,
        italic: isItalic,
        underline: isUnderline
      });
    }
  }
  if (runs.length === 0 && htmlContent) {
    runs.push({ text: htmlContent, bold: false, italic: false, underline: false });
  }
  return runs;
};

const convertHtmlToDocxParagraphs = (html) => {
  const blocks = parseHtmlToBlocks(html);
  const paragraphs = [];

  blocks.forEach(block => {
    const runs = parseInlineRuns(block.content);
    const docxRuns = runs.map(run => {
      return new docx.TextRun({
        text: run.text,
        bold: run.bold ? true : undefined,
        italics: run.italic ? true : undefined,
        underline: run.underline ? {} : undefined
      });
    });

    let alignment = docx.AlignmentType.LEFT;
    if (block.align === 'center') {
      alignment = docx.AlignmentType.CENTER;
    } else if (block.align === 'right') {
      alignment = docx.AlignmentType.RIGHT;
    } else if (block.align === 'justify') {
      alignment = docx.AlignmentType.BOTH;
    }

    const pOptions = {
      children: docxRuns,
      alignment,
      spacing: { after: 120 }
    };

    if (block.type === 'li') {
      pOptions.bullet = { level: 0 };
    }

    paragraphs.push(new docx.Paragraph(pOptions));
  });

  return paragraphs;
};

const renderHtmlToPdf = (doc, html) => {
  const blocks = parseHtmlToBlocks(html);

  blocks.forEach(block => {
    const runs = parseInlineRuns(block.content);
    if (runs.length === 0) return;
    
    let alignment = 'left';
    if (block.align === 'center') {
      alignment = 'center';
    } else if (block.align === 'right') {
      alignment = 'right';
    } else if (block.align === 'justify') {
      alignment = 'justify';
    }

    const baseMargin = 50;
    const xOffset = block.type === 'li' ? 70 : baseMargin;

    if (block.type === 'li') {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#374151')
         .text('•  ', baseMargin, doc.y, { continued: true });
    }

    const firstRun = runs[0];
    const isFirstLast = (runs.length === 1);
    
    let firstFont = 'Helvetica';
    if (firstRun.bold && firstRun.italic) {
      firstFont = 'Helvetica-BoldOblique';
    } else if (firstRun.bold) {
      firstFont = 'Helvetica-Bold';
    } else if (firstRun.italic) {
      firstFont = 'Helvetica-Oblique';
    }

    doc.font(firstFont)
       .fontSize(11)
       .fillColor('#1f2937')
       .text(firstRun.text, block.type === 'li' ? undefined : xOffset, doc.y, {
         continued: !isFirstLast,
         underline: firstRun.underline,
         align: alignment,
         lineGap: 4
       });

    for (let i = 1; i < runs.length; i++) {
      const run = runs[i];
      const isLast = (i === runs.length - 1);

      let fontName = 'Helvetica';
      if (run.bold && run.italic) {
        fontName = 'Helvetica-BoldOblique';
      } else if (run.bold) {
        fontName = 'Helvetica-Bold';
      } else if (run.italic) {
        fontName = 'Helvetica-Oblique';
      }

      doc.font(fontName)
         .fontSize(11)
         .fillColor('#1f2937')
         .text(run.text, {
           continued: !isLast,
           underline: run.underline,
           align: alignment,
           lineGap: 4
         });
    }
    doc.moveDown(0.75);
  });
};

// Configure multer for file uploads (use memory storage for Supabase or disk storage for local)
const storage = useSupabase
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
      },
      filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      }
    });

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Only accept image files
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'innovative-daily-report-system-secret-key-1037',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Static files middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Authentication Middleware
function requireAuth(role) {
  return function (req, res, next) {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    if (role && req.session.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
    }
    next();
  };
}

// --- API ROUTES ---

// Login API
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  let user = null;
  if (useSupabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username.trim())
        .eq('password', password)
        .maybeSingle();
      if (error) {
        console.error('Supabase login query error:', error);
      }
      if (!error && data) user = data;
    } catch (e) {
      console.error('Supabase login exception:', e);
    }
  } else {
    const db = readDb();
    user = db.users.find(u => u.username === username.trim() && u.password === password);
  }

  if (user) {
    req.session.user = { username: user.username, role: user.role };
    const roleName = user.role === 'management' ? 'Management' : 'Worker';
    return res.json({ message: `Logged in successfully as ${roleName}`, user: req.session.user });
  }

  return res.status(401).json({ error: 'Invalid username or password.' });
});

// --- User Management API Routes (Management only) ---

// Get all users
app.get('/api/users', requireAuth('management'), async (req, res) => {
  if (useSupabase) {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const db = readDb();
    res.json(db.users);
  }
});

// Add a worker user
app.post('/api/users', requireAuth('management'), async (req, res) => {
  const { username, password } = req.body;
  if (!username || typeof username !== 'string' || username.trim() === '') {
    return res.status(400).json({ error: 'Invalid username.' });
  }
  if (!password || typeof password !== 'string' || password.trim() === '') {
    return res.status(400).json({ error: 'Invalid password.' });
  }

  const normalizedUsername = username.trim();

  if (useSupabase) {
    try {
      const { data: existing } = await supabase.from('users').select('username').eq('username', normalizedUsername).maybeSingle();
      if (existing) {
        return res.status(400).json({ error: 'Username already exists.' });
      }

      const { error: insErr } = await supabase.from('users').insert([{ username: normalizedUsername, password, role: 'worker' }]);
      if (insErr) throw insErr;

      const { data: allUsers, error: fetchErr } = await supabase.from('users').select('*');
      if (fetchErr) throw fetchErr;

      res.status(201).json({ message: 'Worker account created successfully.', users: allUsers });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const db = readDb();
    if (db.users.some(u => u.username.toLowerCase() === normalizedUsername.toLowerCase())) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    const newUser = {
      username: normalizedUsername,
      password: password,
      role: 'worker'
    };

    db.users.push(newUser);
    writeDb(db);

    res.status(201).json({ message: 'Worker account created successfully.', users: db.users });
  }
});

// Update user credentials
app.put('/api/users/:username', requireAuth('management'), async (req, res) => {
  const targetUsername = req.params.username;
  const { newUsername, newPassword } = req.body;

  if (useSupabase) {
    try {
      if (newUsername && newUsername.trim().toLowerCase() !== targetUsername.toLowerCase()) {
        const { data: existing } = await supabase.from('users').select('username').eq('username', newUsername.trim()).maybeSingle();
        if (existing) {
          return res.status(400).json({ error: 'New username is already taken.' });
        }
      }

      const updates = {};
      if (newUsername) updates.username = newUsername.trim();
      if (newPassword) updates.password = newPassword;

      const { data: updated, error } = await supabase
        .from('users')
        .update(updates)
        .eq('username', targetUsername)
        .select()
        .single();

      if (error) throw error;

      if (targetUsername === req.session.user.username) {
        req.session.user.username = updated.username;
      }

      res.json({ message: 'User updated successfully.', user: updated });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const db = readDb();
    const userIndex = db.users.findIndex(u => u.username === targetUsername);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = db.users[userIndex];

    if (newUsername && newUsername.trim() !== '') {
      const normalizedNewUsername = newUsername.trim();
      if (normalizedNewUsername !== targetUsername && db.users.some(u => u.username.toLowerCase() === normalizedNewUsername.toLowerCase())) {
        return res.status(400).json({ error: 'New username is already taken.' });
      }
      user.username = normalizedNewUsername;
    }

    if (newPassword && newPassword.trim() !== '') {
      user.password = newPassword;
    }

    db.users[userIndex] = user;
    writeDb(db);

    if (targetUsername === req.session.user.username) {
      req.session.user.username = user.username;
    }

    res.json({ message: 'User updated successfully.', user });
  }
});

// Delete user account
app.delete('/api/users/:username', requireAuth('management'), async (req, res) => {
  const targetUsername = req.params.username;

  if (targetUsername === req.session.user.username) {
    return res.status(400).json({ error: 'Cannot delete your own admin account.' });
  }

  if (useSupabase) {
    try {
      const { data: user, error: fetchErr } = await supabase.from('users').select('role').eq('username', targetUsername).single();
      if (fetchErr) throw fetchErr;

      if (user.role === 'management') {
        return res.status(403).json({ error: 'Cannot delete management accounts.' });
      }

      const { error: delErr } = await supabase.from('users').delete().eq('username', targetUsername);
      if (delErr) throw delErr;

      res.json({ message: 'User deleted successfully.' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const db = readDb();
    const userIndex = db.users.findIndex(u => u.username === targetUsername);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (db.users[userIndex].role === 'management') {
      return res.status(403).json({ error: 'Cannot delete management accounts.' });
    }

    db.users.splice(userIndex, 1);
    writeDb(db);

    res.json({ message: 'User deleted successfully.' });
  }
});

// Logout API
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ message: 'Logged out successfully.' });
  });
});

// Get current session user
app.get('/api/auth/me', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// Get departments list
app.get('/api/departments', async (req, res) => {
  if (useSupabase) {
    try {
      const { data, error } = await supabase.from('departments').select('name').order('name');
      if (error) throw error;
      res.json(data.map(d => d.name));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const db = readDb();
    res.json(db.departments);
  }
});

// Add department (Admin only)
app.post('/api/departments', requireAuth('management'), async (req, res) => {
  const { department } = req.body;
  if (!department || typeof department !== 'string' || department.trim() === '') {
    return res.status(400).json({ error: 'Invalid department name.' });
  }

  const normalizedDept = department.trim();

  if (useSupabase) {
    try {
      const { data: existing } = await supabase.from('departments').select('name').eq('name', normalizedDept).maybeSingle();
      if (existing) {
        return res.status(400).json({ error: 'Department already exists.' });
      }

      const { error: insErr } = await supabase.from('departments').insert([{ name: normalizedDept }]);
      if (insErr) throw insErr;

      const { data: allDepts, error: fetchErr } = await supabase.from('departments').select('name').order('name');
      if (fetchErr) throw fetchErr;

      res.status(201).json({ message: 'Department added successfully.', departments: allDepts.map(d => d.name) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const db = readDb();
    if (db.departments.some(d => d.toLowerCase() === normalizedDept.toLowerCase())) {
      return res.status(400).json({ error: 'Department already exists.' });
    }

    db.departments.push(normalizedDept);
    writeDb(db);
    res.status(201).json({ message: 'Department added successfully.', departments: db.departments });
  }
});

// Submit report (Worker only)
app.post('/api/reports', requireAuth('worker'), (req, res) => {
  upload.single('reportImage')(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { employeeName, department, content } = req.body;

    if (!employeeName || !employeeName.trim()) {
      return res.status(400).json({ error: 'Employee name is required.' });
    }
    if (!department || !department.trim()) {
      return res.status(400).json({ error: 'Department is required.' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Report content is required.' });
    }

    try {
      let imagePath = null;
      if (req.file) {
        if (useSupabase) {
          const fileExt = req.file.originalname.split('.').pop();
          const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExt}`;
          const { data, error: uploadError } = await supabase.storage
            .from('report-images')
            .upload(`uploads/${fileName}`, req.file.buffer, {
              contentType: req.file.mimetype,
            });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('report-images')
            .getPublicUrl(`uploads/${fileName}`);
          imagePath = urlData.publicUrl;
        } else {
          imagePath = `/uploads/${req.file.filename}`;
        }
      }

      const newReport = {
        id: Date.now().toString() + '-' + Math.round(Math.random() * 1000),
        employeeName: employeeName.trim(),
        department: department.trim(),
        content: content.trim(),
        imagePath: imagePath,
        submittedBy: req.session.user.username,
        createdAt: new Date().toISOString()
      };

      if (useSupabase) {
        const { error: dbError } = await supabase.from('reports').insert([newReport]);
        if (dbError) throw dbError;
      } else {
        const db = readDb();
        db.reports.unshift(newReport);
        writeDb(db);
      }

      res.status(201).json({ message: 'Report submitted successfully!', report: newReport });
    } catch (e) {
      console.error('Report submission error:', e);
      res.status(500).json({ error: e.message || 'Failed to submit report.' });
    }
  });
});

// Get worker's own submitted reports
app.get('/api/reports/my-reports', requireAuth('worker'), async (req, res) => {
  if (useSupabase) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('submittedBy', req.session.user.username)
        .order('createdAt', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const db = readDb();
    const myReports = db.reports.filter(r => r.submittedBy === req.session.user.username);
    res.json(myReports);
  }
});

// Get all reports (Management only)
app.get('/api/reports/all', requireAuth('management'), async (req, res) => {
  if (useSupabase) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('createdAt', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const db = readDb();
    res.json(db.reports);
  }
});

// Delete report
app.delete('/api/reports/:id', requireAuth(), async (req, res) => {
  const reportId = req.params.id;

  if (useSupabase) {
    try {
      const { data: report, error: fetchErr } = await supabase.from('reports').select('*').eq('id', reportId).single();
      if (fetchErr || !report) {
        return res.status(404).json({ error: 'Report not found.' });
      }

      if (req.session.user.role === 'worker' && report.submittedBy !== req.session.user.username) {
        return res.status(403).json({ error: 'Forbidden. You can only delete your own reports.' });
      }

      if (report.imagePath) {
        try {
          const urlParts = report.imagePath.split('/report-images/');
          if (urlParts.length > 1) {
            const storagePath = urlParts[1];
            await supabase.storage.from('report-images').remove([storagePath]);
          }
        } catch (storageErr) {
          console.error('Error deleting image from Supabase storage:', storageErr);
        }
      }

      const { error: delErr } = await supabase.from('reports').delete().eq('id', reportId);
      if (delErr) throw delErr;

      res.json({ message: 'Report deleted successfully.' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const db = readDb();
    const reportIndex = db.reports.findIndex(r => r.id === reportId);

    if (reportIndex === -1) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const report = db.reports[reportIndex];

    if (req.session.user.role === 'worker' && report.submittedBy !== req.session.user.username) {
      return res.status(403).json({ error: 'Forbidden. You can only delete your own reports.' });
    }

    if (report.imagePath) {
      const cleanedPath = report.imagePath.replace(/^\//, '');
      const fullImagePath = path.join(__dirname, cleanedPath);
      try {
        if (fs.existsSync(fullImagePath)) {
          fs.unlinkSync(fullImagePath);
        }
      } catch (err) {
        console.error('Error deleting image file:', err);
      }
    }

    db.reports.splice(reportIndex, 1);
    writeDb(db);

    res.json({ message: 'Report deleted successfully.' });
  }
});

// Download report as PDF (Management only)
app.get('/api/reports/:id/pdf', requireAuth('management'), async (req, res) => {
  const reportId = req.params.id;
  let report = null;

  if (useSupabase) {
    try {
      const { data, error } = await supabase.from('reports').select('*').eq('id', reportId).single();
      if (!error) report = data;
    } catch (e) {
      console.error(e);
    }
  } else {
    const db = readDb();
    report = db.reports.find(r => r.id === reportId);
  }

  if (!report) {
    return res.status(404).json({ error: 'Report not found.' });
  }

  try {
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report_${reportId}.pdf`);
    
    doc.pipe(res);

    // Document header
    const logoPath = path.join(__dirname, 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, { fit: [150, 45], align: 'center' });
      doc.moveDown(0.75);
    }
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#dc2626').text('Daily Work Report', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    // Divider line
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1.5);

    // Metadata section
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Report Information', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151').text('Employee Name: ', { continued: true })
       .font('Helvetica').fillColor('#4b5563').text(report.employeeName);
    
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151').text('Department: ', { continued: true })
       .font('Helvetica').fillColor('#4b5563').text(report.department);
    
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151').text('Submitted By (Account): ', { continued: true })
       .font('Helvetica').fillColor('#4b5563').text(report.submittedBy);

    const formattedDate = new Date(report.createdAt).toLocaleString();
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151').text('Submitted At: ', { continued: true })
       .font('Helvetica').fillColor('#4b5563').text(formattedDate);
    
    doc.moveDown(1.5);

    // Divider line
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1.5);

    // Work accomplishments
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text("Today's Accomplishments & Tasks Done", { underline: true });
    doc.moveDown(0.75);
    renderHtmlToPdf(doc, report.content);
    doc.moveDown(1.5);

    // Image attachment
    if (report.imagePath) {
      const imgBuffer = await getImageBuffer(report.imagePath);
      if (imgBuffer) {
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('Attached Proof of Work', { align: 'center' });
        doc.moveDown(1);
        doc.image(imgBuffer, {
          fit: [500, 400],
          align: 'center',
          valign: 'center'
        });
      }
    }

    doc.end();
  } catch (error) {
    console.error('Error generating PDF report:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF.' });
    }
  }
});

// Download report as Word DOCX (Management only)
app.get('/api/reports/:id/docx', requireAuth('management'), async (req, res) => {
  const reportId = req.params.id;
  let report = null;

  if (useSupabase) {
    try {
      const { data, error } = await supabase.from('reports').select('*').eq('id', reportId).single();
      if (!error) report = data;
    } catch (e) {
      console.error(e);
    }
  } else {
    const db = readDb();
    report = db.reports.find(r => r.id === reportId);
  }

  if (!report) {
    return res.status(404).json({ error: 'Report not found.' });
  }

  try {
    const docChildren = [];
    const logoPath = path.join(__dirname, 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath);
      docChildren.push(
        new docx.Paragraph({
          children: [
            new docx.ImageRun({
              data: logoData,
              transformation: {
                width: 150,
                height: 45
              }
            })
          ],
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 200 }
        })
      );
    }

    docChildren.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: "DAILY WORK REPORT", bold: true, size: 36, color: "dc2626" })
        ],
        alignment: docx.AlignmentType.CENTER,
        spacing: { after: 300 }
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: "Report Details", bold: true, size: 24, underline: {} })
        ],
        spacing: { after: 150 }
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: "Employee Name: ", bold: true }),
          new docx.TextRun(report.employeeName)
        ]
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: "Department: ", bold: true }),
          new docx.TextRun(report.department)
        ]
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: "Submitted By: ", bold: true }),
          new docx.TextRun(report.submittedBy)
        ]
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: "Submitted At: ", bold: true }),
          new docx.TextRun(new Date(report.createdAt).toLocaleString())
        ],
        spacing: { after: 300 }
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: "Today's Accomplishments & Tasks Done", bold: true, size: 24, underline: {} })
        ],
        spacing: { after: 150 }
      })
    );

    docChildren.push(...convertHtmlToDocxParagraphs(report.content));

    if (report.imagePath) {
      const imgBuffer = await getImageBuffer(report.imagePath);
      if (imgBuffer) {
        docChildren.push(
          new docx.Paragraph({
            children: [
              new docx.TextRun({ text: "Attached Proof of Work", bold: true, size: 24, underline: {} })
            ],
            spacing: { before: 300, after: 150 },
            pageBreakBefore: true
          }),
          new docx.Paragraph({
            children: [
              new docx.ImageRun({
                data: imgBuffer,
                transformation: {
                  width: 500,
                  height: 375
                }
              })
            ],
            alignment: docx.AlignmentType.CENTER
          })
        );
      }
    }

    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: docChildren
      }]
    });

    const buffer = await docx.Packer.toBuffer(doc);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=report_${reportId}.docx`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generating DOCX report:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate Word document.' });
    }
  }
});


// Serve frontend default page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
