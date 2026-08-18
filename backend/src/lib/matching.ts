export type RequirementInput = {
  skills: string;
  preferredSkills?: string | null;
  minExperience: number;
  maxExperience?: number | null;
  location?: string | null;
  visaRequirements?: string | null;
  maxRate?: number | null;
  workMode?: string | null;
  domain?: string | null;
};

export type ConsultantInput = {
  skills: string;
  experienceYears: number;
  visaStatus: string;
  ratePerHour: number;
  marketingStatus?: string | null;
  resumeUrl?: string | null;
  customData?: unknown;
};

const splitTokens = (value: string | null | undefined) => String(value ?? '')
  .toLowerCase()
  .split(/[,;/|]+|\band\b/g)
  .map((item) => item.trim())
  .filter(Boolean);

const unique = (items: string[]) => [...new Set(items)];
const custom = (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const text = (value: unknown) => String(value ?? '').trim();
const normalized = (value: unknown) => text(value).toLowerCase();

const SKILL_EQUIVALENTS: Record<string, string[]> = {
  'javascript': ['js', 'ecmascript'],
  'typescript': ['ts'],
  'react': ['reactjs', 'react.js'],
  'node': ['nodejs', 'node.js'],
  'spring boot': ['springboot', 'spring framework'],
  'aws lambda': ['lambda', 'serverless', 'serverless architecture'],
  'amazon web services': ['aws'],
  'microsoft azure': ['azure'],
  'google cloud platform': ['gcp', 'google cloud'],
  'kubernetes': ['k8s'],
  'postgresql': ['postgres'],
  'machine learning': ['ml'],
  'artificial intelligence': ['ai'],
  'rest api': ['restful api', 'rest services'],
};

function aliases(value: string) {
  const key = normalized(value);
  const direct = SKILL_EQUIVALENTS[key] ?? [];
  const reverse = Object.entries(SKILL_EQUIVALENTS)
    .filter(([, values]) => values.some((item) => normalized(item) === key))
    .flatMap(([canonical, values]) => [canonical, ...values]);
  return unique([key, ...direct.map(normalized), ...reverse.map(normalized)]).filter(Boolean);
}

function skillsEquivalent(required: string, candidate: string) {
  const requiredAliases = aliases(required);
  const candidateAliases = aliases(candidate);
  return requiredAliases.some((left) => candidateAliases.some((right) => left === right || left.includes(right) || right.includes(left)));
}

function evaluateText(actual: string, expected?: string | null) {
  if (!text(expected)) return { evaluated: false, match: null as boolean | null };
  if (!text(actual)) return { evaluated: true, match: false as boolean | null };
  const expectedTokens = splitTokens(expected);
  const actualValue = normalized(actual);
  return { evaluated: true, match: expectedTokens.some((item) => actualValue.includes(item) || item.includes(actualValue)) };
}

function dimension(score: number | null, evaluated: boolean, reason: string) {
  return { score: evaluated && score != null ? Math.max(0, Math.min(100, Math.round(score))) : null, evaluated, reason };
}

export function calculateRequirementMatch(requirement: RequirementInput, consultant: ConsultantInput) {
  const consultantData = custom(consultant.customData);
  const requiredSkills = unique(splitTokens(requirement.skills));
  const preferredSkills = unique(splitTokens(requirement.preferredSkills));
  const consultantSkills = unique(splitTokens(consultant.skills));

  const matchedSkills = requiredSkills.filter((skill) => consultantSkills.some((candidate) => skillsEquivalent(skill, candidate)));
  const missingSkills = requiredSkills.filter((skill) => !matchedSkills.includes(skill));
  const equivalentSkills = requiredSkills.flatMap((skill) => consultantSkills
    .filter((candidate) => normalized(candidate) !== normalized(skill) && skillsEquivalent(skill, candidate))
    .map((candidate) => ({ required: skill, consultant: candidate })));
  const preferredMatched = preferredSkills.filter((skill) => consultantSkills.some((candidate) => skillsEquivalent(skill, candidate)));

  const technicalScore = requiredSkills.length ? (matchedSkills.length / requiredSkills.length) * 100 : 100;
  const experience = Number(consultant.experienceYears ?? 0);
  const minExperience = Number(requirement.minExperience ?? 0);
  const maxExperience = requirement.maxExperience == null ? null : Number(requirement.maxExperience);
  let experienceScore = 100;
  if (minExperience > 0 && experience < minExperience) experienceScore = Math.max(20, (experience / minExperience) * 100);
  const overqualified = maxExperience != null && maxExperience > 0 && experience > maxExperience;

  const consultantLocation = text(consultantData.currentLocation ?? consultantData.preferredLocation);
  const locationEvaluation = evaluateText(consultantLocation, requirement.location);
  const visaEvaluation = evaluateText(consultant.visaStatus, requirement.visaRequirements);
  const workModeEvaluation = evaluateText(text(consultantData.workPreference), requirement.workMode);
  const consultantDomain = text(consultantData.domain ?? consultantData.industryDomain);
  const domainEvaluation = evaluateText(consultantDomain, requirement.domain);

  const rateEvaluated = Number(requirement.maxRate ?? 0) > 0 && Number(consultant.ratePerHour ?? 0) > 0;
  const rateMatch = rateEvaluated ? Number(consultant.ratePerHour) <= Number(requirement.maxRate) : null;
  const rateScore = !rateEvaluated ? null : rateMatch ? 100 : Math.max(0, (Number(requirement.maxRate) / Number(consultant.ratePerHour)) * 100);

  const availabilityValue = normalized(consultant.marketingStatus ?? consultantData.availability ?? consultantData.availableFrom);
  const availabilityEvaluated = Boolean(availabilityValue);
  const availabilityMatch = !availabilityEvaluated ? null : ['active', 'available', 'immediate'].some((item) => availabilityValue.includes(item));

  const dimensions = {
    technical: dimension(technicalScore, true, `${matchedSkills.length} of ${requiredSkills.length || 0} required skills matched`),
    experience: dimension(experienceScore, true, experience < minExperience ? `${(minExperience - experience).toFixed(1)} years below the requested minimum` : overqualified ? 'Consultant is above the preferred experience range' : 'Experience meets the requested range'),
    domain: dimension(domainEvaluation.match == null ? null : domainEvaluation.match ? 100 : 35, domainEvaluation.evaluated, domainEvaluation.evaluated ? (domainEvaluation.match ? 'Relevant domain matched' : 'Different or unconfirmed domain') : 'Job domain not provided'),
    location: dimension(locationEvaluation.match == null ? null : locationEvaluation.match ? 100 : 40, locationEvaluation.evaluated, locationEvaluation.evaluated ? (locationEvaluation.match ? 'Location matched' : 'Location differs; relocation or remote work may still be possible') : 'Job location not provided'),
    visa: dimension(visaEvaluation.match == null ? null : visaEvaluation.match ? 100 : 0, visaEvaluation.evaluated, visaEvaluation.evaluated ? (visaEvaluation.match ? 'Work authorization matched' : 'Work authorization requires recruiter review') : 'Visa requirement not provided'),
    rate: dimension(rateScore, rateEvaluated, !rateEvaluated ? 'Rate was not evaluated because a value is missing' : rateMatch ? 'Consultant rate is within the Job maximum' : 'Consultant rate is above the Job maximum and may be negotiable'),
    availability: dimension(availabilityMatch == null ? null : availabilityMatch ? 100 : 20, availabilityEvaluated, !availabilityEvaluated ? 'Availability not provided' : availabilityMatch ? 'Consultant is available' : 'Consultant is not currently marked available'),
    workMode: dimension(workModeEvaluation.match == null ? null : workModeEvaluation.match ? 100 : 50, workModeEvaluation.evaluated, workModeEvaluation.evaluated ? (workModeEvaluation.match ? 'Work preference matched' : 'Work preference differs') : 'Work mode not provided'),
  };

  const weightedDimensions: Array<[keyof typeof dimensions, number]> = [
    ['technical', 45], ['experience', 15], ['domain', 10], ['location', 7], ['visa', 8], ['rate', 7], ['availability', 5], ['workMode', 3],
  ];
  const evaluatedWeight = weightedDimensions.reduce((sum, [key, weight]) => sum + (dimensions[key].evaluated ? weight : 0), 0);
  const weightedScore = weightedDimensions.reduce((sum, [key, weight]) => sum + (dimensions[key].evaluated ? (dimensions[key].score ?? 0) * weight : 0), 0);
  const preferredBonus = preferredSkills.length ? (preferredMatched.length / preferredSkills.length) * 3 : 0;
  const percentage = Math.max(0, Math.min(100, Math.round((evaluatedWeight ? weightedScore / evaluatedWeight : 0) + preferredBonus)));

  const hardBlockers: string[] = [];
  if (availabilityEvaluated && availabilityMatch === false) hardBlockers.push('Consultant is not currently available for submission.');
  if (!consultant.resumeUrl) hardBlockers.push('Resume is not uploaded.');
  const warnings: string[] = [];
  if (visaEvaluation.evaluated && visaEvaluation.match === false) warnings.push('Visa/work authorization does not match the stated Job requirement.');
  if (rateEvaluated && rateMatch === false) warnings.push(`Expected rate is $${Number(consultant.ratePerHour).toFixed(2)}, above the Job maximum of $${Number(requirement.maxRate).toFixed(2)}.`);
  if (experience < minExperience) warnings.push(`Experience is ${(minExperience - experience).toFixed(1)} years below the requested minimum.`);
  if (overqualified) warnings.push('Consultant may be overqualified; verify interest and commercial fit.');
  if (missingSkills.length) warnings.push(`Missing or unconfirmed skills: ${missingSkills.join(', ')}.`);

  const strengths: string[] = [];
  if (matchedSkills.length) strengths.push(`Matched core skills: ${matchedSkills.join(', ')}.`);
  if (preferredMatched.length) strengths.push(`Matched preferred skills: ${preferredMatched.join(', ')}.`);
  if (experience >= minExperience) strengths.push('Meets the minimum experience requirement.');
  if (domainEvaluation.match) strengths.push('Relevant industry-domain experience.');
  if (visaEvaluation.match) strengths.push('Visa/work authorization matches.');
  if (rateMatch) strengths.push('Expected rate is within the Job range.');

  const category = percentage >= 85 ? 'Strong Match' : percentage >= 70 ? 'Good Match' : percentage >= 55 ? 'Review Recommended' : percentage >= 40 ? 'Possible Match' : 'Low Match';
  const recommendation = hardBlockers.length
    ? 'Resolve the blocking items before submission.'
    : percentage < 70 || warnings.length
      ? 'AI recommendation only — recruiter review and manual override are available.'
      : 'Recommended for recruiter review and submission.';

  return {
    percentage,
    category,
    recommendation,
    dimensions,
    strengths,
    warnings,
    hardBlockers,
    canSubmit: hardBlockers.length === 0,
    requiresOverride: hardBlockers.length === 0 && (percentage < 55 || Boolean(visaEvaluation.evaluated && visaEvaluation.match === false) || Boolean(rateEvaluated && rateMatch === false)),
    matched: { skills: matchedSkills, preferredSkills: preferredMatched, equivalentSkills, experience: experience >= minExperience, location: locationEvaluation.match, visa: visaEvaluation.match, rate: rateMatch, availability: availabilityMatch },
    missing: { skills: missingSkills, experienceYears: experience >= minExperience ? 0 : Math.max(0, minExperience - experience), location: locationEvaluation.match === false ? requirement.location : null, visa: visaEvaluation.match === false ? requirement.visaRequirements : null, rateOverBy: rateMatch === false && requirement.maxRate ? Number(consultant.ratePerHour) - Number(requirement.maxRate) : 0 },
    weights: { technical: 45, experience: 15, domain: 10, location: 7, visa: 8, rate: 7, availability: 5, workMode: 3 },
  };
}
