import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';

const STORIES_RAW_DIR = path.resolve('stories_raw');
const PUBLIC_DIR = path.resolve('public');
const OUTPUT_STORIES_DIR = path.join(PUBLIC_DIR, 'stories');

// Consistent salt derived per passphrase/story so Web Crypto can cache the PBKDF2 key per session
function getSaltForPassphrase(passphrase) {
  return crypto.createHash('sha256').update(passphrase + '_tp_salt_v1').digest().subarray(0, 16);
}

// AES-256-GCM Encryption with PBKDF2 (using consistent salt for instant decryption caching in browser)
function encryptPayload(plaintextBuffer, passphrase) {
  const salt = getSaltForPassphrase(passphrase);
  // PBKDF2: 100,000 iterations, sha256, 32-byte key (compatible with Web Crypto API)
  const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12); // Unique 12 bytes IV per file for AES-GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes auth tag

  // Combined format: [16 bytes salt][12 bytes IV][16 bytes authTag][ciphertext]
  return Buffer.concat([salt, iv, tag, encrypted]);
}

// Generates an 8-character hex hash from a story slug or identifier
function generate8CharHash(identifier) {
  return crypto.createHash('sha256').update(identifier.trim()).digest('hex').substring(0, 8);
}

// Parses frontmatter if present (between --- markers)
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = match[1];
  const body = content.slice(match[0].length);
  const frontmatter = {};

  yamlBlock.split(/\r?\n/).forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const val = line.slice(colonIndex + 1).trim().replace(/^['"](.*)['"]$/, '$1');
      frontmatter[key] = val;
    }
  });

  return { frontmatter, body };
}

/**
 * Splits markdown text into natural chapters and major sections based on headers (#, ##, ###)
 * and generates a Table of Contents. Avoids artificial word-boundary chunking so text flows
 * seamlessly onto dynamic columns in the reader without line cuts.
 *
 * @param {string} rawMarkdown - The complete raw markdown of the story.
 * @param {string} defaultTitle - Fallback title if frontmatter does not define one.
 * @returns {{
 *   meta: { title: string, author: string, synopsis: string, totalChunks: number, estimatedMinutes: number },
 *   toc: Array<{ title: string, level: number, chunkIndex: number }>,
 *   chunks: string[]
 * }}
 */
function processMarkdownToChapters(rawMarkdown, defaultTitle) {
  const { frontmatter, body } = parseFrontmatter(rawMarkdown);
  const lines = body.split(/\r?\n/);

  const title = frontmatter.title || defaultTitle || 'Untitled Story';
  const synopsis = frontmatter.synopsis || frontmatter.description || '';
  const author = frontmatter.author || 'Anonymous';

  const chunks = [];
  const toc = [];
  let currentLines = [];
  let currentTitle = 'Beginning';
  let currentLevel = 1;

  function flushChapter() {
    if (currentLines.length > 0) {
      const text = currentLines.join('\n').trim();
      if (text.length > 0) {
        const chapterIdx = chunks.length;
        chunks.push(text);
        toc.push({
          title: currentTitle,
          level: currentLevel,
          chunkIndex: chapterIdx
        });
      }
      currentLines = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,3})\s+(.*)$/);

    if (headerMatch) {
      const level = headerMatch[1].length;
      const headingTitle = headerMatch[2].trim();

      // Flush previously accumulated chapter text before starting a new chapter
      if (currentLines.length > 0) {
        flushChapter();
      }

      currentTitle = headingTitle;
      currentLevel = level;
      currentLines.push(line);
      continue;
    }

    currentLines.push(line);
  }

  flushChapter();

  // If no headings found in the entire document, treat whole body as single chapter
  if (chunks.length === 0 && body.trim().length > 0) {
    chunks.push(body.trim());
    toc.push({ title: 'Beginning', level: 1, chunkIndex: 0 });
  }

  return {
    meta: {
      title,
      author,
      synopsis,
      totalChunks: chunks.length,
      estimatedMinutes: Math.max(1, Math.ceil(body.split(/\s+/).length / 200))
    },
    toc,
    chunks
  };
}

async function getPassphrase() {
  if (process.env.PASSPHRASE && process.env.PASSPHRASE.trim().length > 0) {
    return process.env.PASSPHRASE.trim();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Enter encryption passphrase: ', (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (!trimmed) {
        console.error('Error: Passphrase cannot be empty.');
        process.exit(1);
      }
      resolve(trimmed);
    });
  });
}

async function main() {
  console.log('--- Timepass Tea Story Encryptor ---');

  if (!fs.existsSync(STORIES_RAW_DIR)) {
    fs.mkdirSync(STORIES_RAW_DIR, { recursive: true });
    console.log(`Created empty '${STORIES_RAW_DIR}' folder. Place your raw .md files there.`);
    return;
  }

  const files = fs.readdirSync(STORIES_RAW_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log(`No .md files found in '${STORIES_RAW_DIR}'. Add some Markdown stories first.`);
    return;
  }

  const passphrase = await getPassphrase();

  // Ensure output dirs exist
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  if (!fs.existsSync(OUTPUT_STORIES_DIR)) fs.mkdirSync(OUTPUT_STORIES_DIR, { recursive: true });

  const catalog = [];

  for (const filename of files) {
    const rawFilePath = path.join(STORIES_RAW_DIR, filename);
    const content = fs.readFileSync(rawFilePath, 'utf-8');
    const defaultTitle = path.basename(filename, '.md').replace(/[-_]/g, ' ');
    const rawId = path.basename(filename, '.md');
    
    // Generate the 8-character hashed ID
    const hashedId = generate8CharHash(rawId);
    console.log(`Processing '${filename}' -> 8-Char ID: [${hashedId}]`);

    const { meta, toc, chunks } = processMarkdownToChapters(content, defaultTitle);
    const storyOutputDir = path.join(OUTPUT_STORIES_DIR, hashedId);

    // Clean story output directory before rewriting
    if (fs.existsSync(storyOutputDir)) {
      fs.rmSync(storyOutputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(storyOutputDir, { recursive: true });

    // 1. Encrypt and write ToC
    const encryptedToc = encryptPayload(Buffer.from(JSON.stringify(toc), 'utf-8'), passphrase);
    fs.writeFileSync(path.join(storyOutputDir, 'toc.json.enc'), encryptedToc);

    // 2. Encrypt and write chunks
    for (let i = 0; i < chunks.length; i++) {
      const encryptedChunk = encryptPayload(Buffer.from(chunks[i], 'utf-8'), passphrase);
      fs.writeFileSync(path.join(storyOutputDir, `chunk-${i}.enc`), encryptedChunk);
    }

    // Add to catalog
    catalog.push({
      id: hashedId,
      title: meta.title,
      author: meta.author,
      synopsis: meta.synopsis,
      totalChunks: meta.totalChunks,
      estimatedMinutes: meta.estimatedMinutes
    });
  }

  // 3. Encrypt and write the main catalog.json.enc
  const encryptedCatalog = encryptPayload(Buffer.from(JSON.stringify(catalog), 'utf-8'), passphrase);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'catalog.json.enc'), encryptedCatalog);

  console.log(`\nSuccess! Encrypted ${files.length} story/stories into '${PUBLIC_DIR}'.`);
  console.log(`- Catalog: public/catalog.json.enc`);
  console.log(`- Stories directory: public/stories/<8-char-hash>/`);
}

main().catch(err => {
  console.error('Fatal error during encryption:', err);
  process.exit(1);
});
