import fs from 'fs';
import { marked } from 'marked';

// Read the markdown file
const markdownContent = fs.readFileSync('USER_MANUAL.md', 'utf8');

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  headerPrefix: '',
  mangle: false
});

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Parse markdown into sections
function parseSections(md) {
  const lines = md.split('\n');
  const sections = [];
  let currentSection = null;
  let currentContent = [];
  let inMainTitle = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip the main title (H1 at the start)
    if (i === 0 && line.startsWith('# ')) {
      inMainTitle = true;
      continue;
    }
    
    // Check for H2 headings (main sections)
    if (line.startsWith('## ') && !line.startsWith('###')) {
      // Save previous section
      if (currentSection) {
        currentSection.content = currentContent.join('\n');
        sections.push(currentSection);
      }
      
      // Start new section
      const title = line.substring(3).trim();
      // Skip "Table of Contents" section
      if (title.toLowerCase() !== 'table of contents') {
        currentSection = {
          id: slugify(title),
          title: title,
          content: '',
          level: 2
        };
        currentContent = []; // Don't include the heading line - it will be added by marked
      } else {
        currentSection = null;
        currentContent = [];
      }
    } else if (currentSection) {
      // Add content to current section
      currentContent.push(line);
    }
  }
  
  // Save last section
  if (currentSection) {
    currentSection.content = currentContent.join('\n');
    sections.push(currentSection);
  }
  
  return sections;
}

// Group sections by module (for better organization)
function groupSections(sections) {
  const grouped = [];
  let currentGroup = null;
  
  for (const section of sections) {
    const id = section.id;
    const title = section.title.toLowerCase();
    
    // Check if this is a main module section (ends with "Module" or is a top-level section)
    const isMainModule = id.endsWith('-module') || 
                         id === 'introduction' || 
                         id === 'getting-started' || 
                         id === 'menu-structure' || 
                         id === 'dashboard' || 
                         id === 'troubleshooting' || 
                         id === 'common-features' || 
                         id === 'quick-reference-guide' || 
                         id === 'appendix';
    
    // Check if this is a workflows section (should be grouped under its module)
    const isWorkflowsSection = title.includes('workflows') || title.includes('step by step');
    
    if (isMainModule) {
      // Save previous group
      if (currentGroup) {
        grouped.push(currentGroup);
      }
      // Start new group
      currentGroup = {
        id: section.id,
        title: section.title,
        content: section.content,
        subsections: []
      };
    } else if (isWorkflowsSection && currentGroup) {
      // Add workflows as subsection of current module
      currentGroup.subsections.push(section);
    } else if (currentGroup) {
      // Add other sections as subsections
      currentGroup.subsections.push(section);
    } else {
      // Standalone section (shouldn't happen, but handle it)
      grouped.push({
        id: section.id,
        title: section.title,
        content: section.content,
        subsections: []
      });
    }
  }
  
  // Save last group
  if (currentGroup) {
    grouped.push(currentGroup);
  }
  
  return grouped;
}

// Generate TOC HTML
function generateTOC(groupedSections) {
  let html = '<ul class="toc" id="toc">\n';
  
  groupedSections.forEach(group => {
    html += `  <li class="toc-item">\n`;
    html += `    <a href="#" class="toc-link toc-main" data-section-id="${group.id}">${group.title}</a>\n`;
    
    if (group.subsections && group.subsections.length > 0) {
      html += `    <ul class="toc-sub">\n`;
      group.subsections.forEach(sub => {
        html += `      <li><a href="#" class="toc-link toc-sub" data-section-id="${sub.id}">${sub.title}</a></li>\n`;
      });
      html += `    </ul>\n`;
    }
    
    html += `  </li>\n`;
  });
  
  html += '</ul>';
  return html;
}

// Parse sections
const allSections = parseSections(markdownContent);
const groupedSections = groupSections(allSections);

// Convert all section contents to HTML (add heading back)
const sectionsData = {};
allSections.forEach(section => {
  // Add the H2 heading back to the content before parsing
  const contentWithHeading = `## ${section.title}\n\n${section.content}`;
  sectionsData[section.id] = marked.parse(contentWithHeading);
});

// Also convert grouped sections
groupedSections.forEach(group => {
  const contentWithHeading = `## ${group.title}\n\n${group.content}`;
  sectionsData[group.id] = marked.parse(contentWithHeading);
  if (group.subsections) {
    group.subsections.forEach(sub => {
      const subContentWithHeading = `## ${sub.title}\n\n${sub.content}`;
      sectionsData[sub.id] = marked.parse(subContentWithHeading);
    });
  }
});

// Get main title
const mainTitle = markdownContent.split('\n')[0].replace(/^#\s+/, '');

// Generate TOC HTML
const tocHTML = generateTOC(groupedSections);

// Create HTML template
const htmlTemplate = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Production Management System - User Manual</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html {
            scroll-behavior: smooth;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            transition: background-color 0.2s ease, color 0.2s ease;
        }

        :root {
            --bg-primary: #ffffff;
            --bg-secondary: #f8fafc;
            --bg-tertiary: #f1f5f9;
            --text-primary: #1e293b;
            --text-secondary: #64748b;
            --text-tertiary: #94a3b8;
            --border-color: #e2e8f0;
            --accent-color: #3b82f6;
            --accent-hover: #2563eb;
            --sidebar-width: 280px;
            --header-height: 60px;
        }

        [data-theme="dark"] {
            --bg-primary: #1e293b;
            --bg-secondary: #334155;
            --bg-tertiary: #475569;
            --text-primary: #f8fafc;
            --text-secondary: #cbd5e1;
            --text-tertiary: #94a3b8;
            --border-color: #475569;
            --accent-color: #60a5fa;
            --accent-hover: #3b82f6;
        }

        .header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: var(--header-height);
            background-color: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .header h1 {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-primary);
        }

        .header-controls {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .search-box {
            position: relative;
        }

        .search-box input {
            padding: 8px 35px 8px 12px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            width: 300px;
            font-size: 14px;
        }

        .search-box input:focus {
            outline: none;
            border-color: var(--accent-color);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .search-icon {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-secondary);
        }

        .theme-toggle {
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 8px 12px;
            cursor: pointer;
            color: var(--text-primary);
            font-size: 14px;
            transition: all 0.2s;
        }

        .theme-toggle:hover {
            background: var(--bg-secondary);
        }

        .sidebar-toggle {
            display: none;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 8px 12px;
            cursor: pointer;
            color: var(--text-primary);
        }

        .sidebar {
            position: fixed;
            left: 0;
            top: var(--header-height);
            width: var(--sidebar-width);
            height: calc(100vh - var(--header-height));
            background-color: var(--bg-secondary);
            border-right: 1px solid var(--border-color);
            overflow-y: auto;
            padding: 20px;
            z-index: 999;
            transition: transform 0.3s ease;
        }

        .sidebar::-webkit-scrollbar {
            width: 6px;
        }

        .sidebar::-webkit-scrollbar-track {
            background: var(--bg-secondary);
        }

        .sidebar::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 3px;
        }

        .sidebar h2 {
            font-size: 1.1rem;
            margin-bottom: 15px;
            color: var(--text-primary);
            font-weight: 600;
        }

        .toc {
            list-style: none;
        }

        .toc-item {
            margin-bottom: 8px;
        }

        .toc-link {
            display: block;
            padding: 8px 12px;
            color: var(--text-secondary);
            text-decoration: none;
            border-radius: 6px;
            transition: all 0.2s;
            font-size: 14px;
            cursor: pointer;
        }

        .toc-link:hover {
            background-color: var(--bg-tertiary);
            color: var(--accent-color);
        }

        .toc-link.active {
            background-color: var(--accent-color);
            color: white;
        }

        .toc-main {
            font-weight: 600;
            color: var(--text-primary);
        }

        .toc-sub {
            list-style: none;
            margin-left: 20px;
            margin-top: 5px;
        }

        .main-content {
            margin-left: var(--sidebar-width);
            margin-top: var(--header-height);
            padding: 40px;
            max-width: 1200px;
            min-height: calc(100vh - var(--header-height));
        }

        .content-wrapper {
            background-color: var(--bg-primary);
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .content-wrapper h1 {
            font-size: 2.5rem;
            margin-bottom: 20px;
            color: var(--text-primary);
            border-bottom: 3px solid var(--accent-color);
            padding-bottom: 10px;
        }

        .content-wrapper h2 {
            font-size: 2rem;
            margin-top: 40px;
            margin-bottom: 20px;
            color: var(--text-primary);
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 8px;
        }

        .content-wrapper h3 {
            font-size: 1.5rem;
            margin-top: 30px;
            margin-bottom: 15px;
            color: var(--text-primary);
        }

        .content-wrapper h4 {
            font-size: 1.25rem;
            margin-top: 25px;
            margin-bottom: 12px;
            color: var(--text-primary);
        }

        .content-wrapper p {
            margin-bottom: 15px;
            color: var(--text-secondary);
        }

        .content-wrapper ul, .content-wrapper ol {
            margin-left: 30px;
            margin-bottom: 15px;
            color: var(--text-secondary);
        }

        .content-wrapper li {
            margin-bottom: 8px;
        }

        .content-wrapper strong {
            color: var(--text-primary);
            font-weight: 600;
        }

        .content-wrapper code {
            background-color: var(--bg-tertiary);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            color: var(--accent-color);
        }

        .content-wrapper pre {
            background-color: var(--bg-tertiary);
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            margin-bottom: 20px;
            border: 1px solid var(--border-color);
        }

        .content-wrapper pre code {
            background: none;
            padding: 0;
            color: var(--text-primary);
        }

        .content-wrapper table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background-color: var(--bg-primary);
        }

        .content-wrapper table th,
        .content-wrapper table td {
            padding: 12px;
            border: 1px solid var(--border-color);
            text-align: left;
        }

        .content-wrapper table th {
            background-color: var(--bg-tertiary);
            font-weight: 600;
            color: var(--text-primary);
        }

        .content-wrapper table td {
            color: var(--text-secondary);
        }

        .content-wrapper hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 30px 0;
        }

        .highlight {
            background-color: rgba(59, 130, 246, 0.2);
            padding: 2px 4px;
            border-radius: 3px;
        }

        .welcome-screen {
            text-align: center;
            padding: 100px 40px;
            color: var(--text-secondary);
        }

        .welcome-screen h1 {
            font-size: 3rem;
            margin-bottom: 20px;
            color: var(--text-primary);
            border: none;
            padding: 0;
        }

        .welcome-screen p {
            font-size: 1.2rem;
            color: var(--text-secondary);
        }

        .back-to-top {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background-color: var(--accent-color);
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: all 0.3s;
            z-index: 1000;
            font-size: 20px;
        }

        .back-to-top:hover {
            background-color: var(--accent-hover);
            transform: translateY(-2px);
        }

        .back-to-top.show {
            display: flex;
        }

        @media print {
            .sidebar, .header, .back-to-top {
                display: none;
            }
            .main-content {
                margin-left: 0;
                margin-top: 0;
            }
        }

        @media (max-width: 768px) {
            .sidebar {
                transform: translateX(-100%);
            }
            .sidebar.open {
                transform: translateX(0);
            }
            .main-content {
                margin-left: 0;
                padding: 20px;
            }
            .sidebar-toggle {
                display: block;
            }
            .search-box input {
                width: 200px;
            }
        }
    </style>
</head>
<body>
    <header class="header">
        <div style="display: flex; align-items: center; gap: 15px;">
            <button class="sidebar-toggle" onclick="toggleSidebar()">☰</button>
            <h1>Production Management System - User Manual</h1>
        </div>
        <div class="header-controls">
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Search manual..." oninput="handleSearch()">
                <span class="search-icon">🔍</span>
            </div>
            <button class="theme-toggle" onclick="toggleTheme()">🌓 Toggle Theme</button>
        </div>
    </header>

    <nav class="sidebar" id="sidebar">
        <h2>Table of Contents</h2>
        ${tocHTML}
    </nav>

    <main class="main-content" id="mainContent">
        <div class="content-wrapper" id="contentWrapper">
            <div class="welcome-screen">
                <h1>${mainTitle}</h1>
                <p>Select a topic from the sidebar to begin reading</p>
                <p style="margin-top: 20px; font-size: 0.9rem; color: var(--text-tertiary);">Last Updated: 21 December 2025</p>
            </div>
        </div>
    </main>

    <button class="back-to-top" id="backToTop" onclick="scrollToTop()">↑</button>

    <script>
        // Sections data
        const sectionsData = ${JSON.stringify(sectionsData, null, 8)};

        let currentTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);

        function loadSection(sectionId) {
            const content = sectionsData[sectionId];
            const wrapper = document.getElementById('contentWrapper');
            
            if (content) {
                wrapper.innerHTML = content;
                // Update active link
                updateActiveLink(sectionId);
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                wrapper.innerHTML = '<div class="welcome-screen"><h1>Section Not Found</h1><p>The requested section could not be loaded.</p></div>';
            }
        }

        function updateActiveLink(sectionId) {
            document.querySelectorAll('.toc-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('data-section-id') === sectionId) {
                    link.classList.add('active');
                }
            });
        }

        function setupTOCLinks() {
            document.querySelectorAll('.toc-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const sectionId = this.getAttribute('data-section-id');
                    if (sectionId) {
                        loadSection(sectionId);
                    }
                });
            });
        }

        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

        function toggleTheme() {
            currentTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', currentTheme);
            localStorage.setItem('theme', currentTheme);
        }

        function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('open');
        }

        function handleSearch() {
            const query = document.getElementById('searchInput').value.toLowerCase().trim();
            if (!query) {
                // If search is cleared, reload current section
                const activeLink = document.querySelector('.toc-link.active');
                if (activeLink) {
                    const sectionId = activeLink.getAttribute('data-section-id');
                    if (sectionId) {
                        loadSection(sectionId);
                    }
                }
                return;
            }
            
            // Search through all sections
            const results = [];
            for (const [sectionId, content] of Object.entries(sectionsData)) {
                if (content.toLowerCase().includes(query)) {
                    results.push(sectionId);
                }
            }
            
            // If results found, show first match
            if (results.length > 0) {
                loadSection(results[0]);
                // Highlight search terms
                setTimeout(() => {
                    const wrapper = document.getElementById('contentWrapper');
                    const escapedQuery = query.replace(/[.*+?^$()|[\\]\\\\]/g, '\\\\$&');
                    const regex = new RegExp('(' + escapedQuery + ')', 'gi');
                    wrapper.innerHTML = wrapper.innerHTML.replace(regex, '<span class="highlight">$1</span>');
                }, 100);
            }
        }

        // Initialize
        setupTOCLinks();
        
        // Show back to top button on scroll
        window.addEventListener('scroll', () => {
            const backToTop = document.getElementById('backToTop');
            if (window.pageYOffset > 300) {
                backToTop.classList.add('show');
            } else {
                backToTop.classList.remove('show');
            }
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.querySelector('.sidebar-toggle');
            if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                if (!sidebar.contains(e.target) && e.target !== toggle) {
                    sidebar.classList.remove('open');
                }
            }
        });
    </script>
</body>
</html>`;

// Write the HTML file
fs.writeFileSync('USER_MANUAL.html', htmlTemplate);
// Also copy to static folder for web access
fs.writeFileSync('static/USER_MANUAL.html', htmlTemplate);
console.log('✅ Interactive manual generated: USER_MANUAL.html');
console.log('✅ Copied to static/USER_MANUAL.html for web access');
console.log('📖 Open USER_MANUAL.html in your browser to view the interactive manual');
