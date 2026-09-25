import path from 'node:path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';

export type ParsedResume = {
  name: string;
  email: string;
  phone: string;
  technology: string;
  role: string;
  primarySkill: string;
  technicalSkills: string[];
  skills: string;
  experienceYears: number | null;
  education: { qualification: string; institute: string; details: string }[];
  certifications: string[];
  projects: string[];
  location: string;
  visa: string;
  availability: string;
};

const SKILLS = [
  'JavaScript','TypeScript','React','React.js','Angular','Vue.js','Node.js','Express.js','Next.js','NestJS',
  'Java','Spring Boot','Python','Django','Flask','FastAPI','.NET','C#','C++','C','Go','Golang','Rust','Ruby','PHP','Laravel',
  'SQL','PostgreSQL','MySQL','Oracle','SQL Server','MongoDB','Redis','Snowflake','BigQuery','DynamoDB',
  'AWS','Azure','GCP','Docker','Kubernetes','Terraform','Jenkins','GitHub Actions','GitLab CI','CI/CD','Linux','Unix',
  'REST API','RESTful API','GraphQL','Microservices','Kafka','RabbitMQ','Spark','Hadoop','Databricks','Airflow','ETL',
  'Machine Learning','Deep Learning','Artificial Intelligence','Data Science','NLP','LLM','Generative AI','TensorFlow','PyTorch','Scikit-learn',
  'Power BI','Tableau','Excel','Salesforce','SAP','ServiceNow','Workday','MuleSoft','Informatica','Selenium','Cypress','Playwright',
  'HTML','CSS','Tailwind CSS','Bootstrap','Figma','Jira','Agile','Scrum','DevOps','SRE','Cybersecurity','Networking'
];

const VISA_MAP: Array<[RegExp,string]> = [
  [/\b(us citizen|usc|citizen)\b/i,'USC/Citizen'], [/\bgreen card ead|gc[- ]?ead\b/i,'GC-EAD'],
  [/\bgreen card|\bgc\b/i,'GC'], [/\bh1[- ]?b\b/i,'H1B'], [/\bh4[- ]?ead\b/i,'H4 EAD'],
  [/\bl2s\b|\bl2 ead\b/i,'L2S'], [/\bopt\b|\bstem opt\b/i,'OPT']
];

function clean(text: string) { return text.replace(/\r/g, '').replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(); }
function unique(values: string[]) { return [...new Set(values.map((v) => v.trim()).filter(Boolean))]; }
function lineValue(text: string, labels: string[]) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:${escaped})\\s*[:\\-]\\s*([^\\n]+)`, 'i'));
  return match?.[1]?.trim() ?? '';
}
function sectionLines(text: string, headings: string[], stopHeadings: string[]) {
  const all = [...headings, ...stopHeadings].map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const start = new RegExp(`(?:^|\\n)\\s*(?:${headings.join('|')})\\s*[:\\-]?\\s*\\n`, 'i').exec(text);
  if (!start) return [];
  const remainder = text.slice((start.index ?? 0) + start[0].length);
  const stop = new RegExp(`\\n\\s*(?:${all.join('|')})\\s*[:\\-]?\\s*(?:\\n|$)`, 'i').exec(remainder);
  return remainder.slice(0, stop?.index ?? Math.min(remainder.length, 2500)).split('\n').map((l) => l.replace(/^[•▪◦*\-–—\d.)\s]+/, '').trim()).filter(Boolean);
}

export async function extractResumeText(filename: string, buffer: Buffer, savedFilePath?: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return clean((await pdf(buffer)).text ?? '');
  if (ext === '.docx') return clean((await mammoth.extractRawText({ buffer })).value ?? '');
  if (ext === '.doc') {
    const extractor = new WordExtractor();
    if (!savedFilePath) throw new Error('The DOC resume could not be staged for parsing.');
    const document = await extractor.extract(savedFilePath);
    return clean(document.getBody());
  }
  throw Object.assign(new Error('Unsupported resume format. Upload PDF, DOC or DOCX.'), { statusCode: 415 });
}

export function parseResumeText(rawText: string): ParsedResume {
  const text = clean(rawText);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
  const phone = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0]?.trim() ?? '';
  const labeledName = lineValue(text, ['Name','Candidate Name','Consultant Name']);
  const name = labeledName || lines.find((line) => !line.includes('@') && !/\d{3}/.test(line) && line.length >= 3 && line.length <= 60 && /^[A-Za-z][A-Za-z .'-]+$/.test(line)) || '';

  const foundSkills = unique(SKILLS.filter((skill) => {
    const normalized = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\.js/g, '(?:\\.js)?');
    return new RegExp(`(^|[^A-Za-z0-9])${normalized}([^A-Za-z0-9]|$)`, 'i').test(text);
  }));
  const labeledSkills = lineValue(text, ['Technical Skills','Core Skills','Skills','Technologies','Tech Stack'])
    .split(/[,;|]/).map((v) => v.trim()).filter((v) => v.length > 1 && v.length < 50);
  const technicalSkills = unique([...foundSkills, ...labeledSkills]);

  const experienceMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional\s+|total\s+|relevant\s+)?experience/gi)].map((m) => Number(m[1]));
  const experienceYears = experienceMatches.length ? Math.max(...experienceMatches.filter((v) => v <= 60)) : null;

  const role = lineValue(text, ['Current Role','Current Title','Job Title','Role','Designation']) ||
    lines.find((line) => /\b(engineer|developer|architect|consultant|analyst|manager|administrator|scientist|lead|specialist|qa|tester)\b/i.test(line) && line.length < 100) || '';

  const primarySkill = lineValue(text, ['Primary Skill','Primary Technology','Technology']) || technicalSkills[0] || '';
  const location = lineValue(text, ['Location','Current Location','Address']) || '';
  const visa = VISA_MAP.find(([pattern]) => pattern.test(text))?.[1] ?? '';
  const availability = lineValue(text, ['Availability','Available From','Notice Period']) || '';

  const educationLines = sectionLines(text, ['EDUCATION','ACADEMIC QUALIFICATIONS','ACADEMICS'], ['CERTIFICATIONS','PROJECTS','EXPERIENCE','EMPLOYMENT','SKILLS']);
  const qualificationMatch = text.match(/\b(Ph\.?D|M\.?Tech|M\.?E\.?|MBA|MCA|M\.?Sc|B\.?Tech|B\.?E\.?|BBA|BCA|B\.?Sc|B\.?Com|M\.?Com|Diploma|Master(?:'s)?|Bachelor(?:'s)?)\b/i)?.[0] ?? '';
  const institute = educationLines.find((line) => /university|college|institute|school/i.test(line)) ?? '';
  const education = educationLines.length || qualificationMatch ? [{ qualification: qualificationMatch, institute, details: educationLines.join(' | ') }] : [];

  const certifications = unique(sectionLines(text, ['CERTIFICATIONS','CERTIFICATES'], ['PROJECTS','EXPERIENCE','EMPLOYMENT','EDUCATION','SKILLS']).slice(0, 20));
  const projects = unique(sectionLines(text, ['PROJECTS','KEY PROJECTS','ACADEMIC PROJECTS'], ['CERTIFICATIONS','EXPERIENCE','EMPLOYMENT','EDUCATION','SKILLS']).slice(0, 20));

  return { name, email, phone, technology: primarySkill, role, primarySkill, technicalSkills, skills: technicalSkills.join(', '), experienceYears, education, certifications, projects, location, visa, availability };
}
