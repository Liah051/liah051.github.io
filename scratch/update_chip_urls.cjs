const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '..', 'src', 'content', 'glossary', 'astralparty', 'chips');

function updateUrls() {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return console.log('Unable to scan directory: ' + err);
    }
    
    files.forEach((file) => {
      if (file.endsWith('.mdx')) {
        const filePath = path.join(directoryPath, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Extract the term from frontmatter
        const termMatch = content.match(/term:\s*"([^"]+)"/);
        if (termMatch) {
          const term = termMatch[1];
          const newUrl = `/posts/astralparty/chips#${term}`;
          
          // Replace url: "" with url: "newUrl"
          content = content.replace(/url:\s*""/, `url: "${newUrl}"`);
          
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`Updated ${file} with url: ${newUrl}`);
        }
      }
    });
  });
}

updateUrls();
