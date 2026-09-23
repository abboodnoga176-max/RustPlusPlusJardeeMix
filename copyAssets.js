const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist', 'src');

function copyFolderSync(from, to) {
    if (!fs.existsSync(from)) return;

    if (!fs.existsSync(to)) {
        fs.mkdirSync(to, { recursive: true });
    }

    fs.readdirSync(from).forEach(element => {
        const stat = fs.lstatSync(path.join(from, element));
        if (stat.isFile()) {
            if (!element.endsWith('.ts') && !element.endsWith('.js')) {
                 fs.copyFileSync(path.join(from, element), path.join(to, element));
            }
        } else if (stat.isDirectory()) {
            copyFolderSync(path.join(from, element), path.join(to, element));
        }
    });
}

copyFolderSync(path.join(srcDir, 'languages'), path.join(distDir, 'languages'));
copyFolderSync(path.join(srcDir, 'staticFiles'), path.join(distDir, 'staticFiles'));
copyFolderSync(path.join(srcDir, 'templates'), path.join(distDir, 'templates'));
copyFolderSync(path.join(srcDir, 'resources'), path.join(distDir, 'resources'));

if (!fs.existsSync(path.join(__dirname, 'dist', 'config'))) {
    fs.mkdirSync(path.join(__dirname, 'dist', 'config'), { recursive: true });
}

fs.copyFileSync(path.join(__dirname, 'config', 'allowedRecycleItems.json'), path.join(__dirname, 'dist', 'config', 'allowedRecycleItems.json'));
fs.copyFileSync(path.join(__dirname, 'config', 'index.js'), path.join(__dirname, 'dist', 'config', 'index.js'));
