const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const BASE_REPORTS = path.join(__dirname, '..', 'reports');

function safeRelativePath(p){
  const clean = String(p || '').replace(/\\/g, '/');
  const finalPath = path.normalize(path.join(BASE_REPORTS, clean));

  if(!finalPath.startsWith(BASE_REPORTS)){
    throw new Error('Ruta no permitida.');
  }

  return finalPath;
}

router.get('/', async (req, res) => {
  try {
    const relPath = req.query.path || '';
    const currentPath = safeRelativePath(relPath);

    if(!fs.existsSync(currentPath)){
      return res.json({
        ok:true,
        path: relPath,
        folders: [],
        files: []
      });
    }

    const items = fs.readdirSync(currentPath, { withFileTypes:true });

    const folders = [];
    const files = [];

    for(const item of items){
      const itemRelPath = path.join(relPath, item.name).replace(/\\/g, '/');

      if(item.isDirectory()){
        folders.push({
          name: item.name,
          path: itemRelPath
        });
      } else if(item.isFile() && item.name.toLowerCase().endsWith('.pdf')){
        files.push({
          name: item.name,
          path: itemRelPath,
          url: '/reports/' + itemRelPath
        });
      }
    }

    res.json({
      ok:true,
      path: relPath,
      folders,
      files
    });

  } catch (e) {
    res.json({
      ok:false,
      message:e.message
    });
  }
});

module.exports = router;