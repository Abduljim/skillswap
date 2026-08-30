import {
  calculateMatchScore,
  isRecommended,
  MatcherProfile,
  MIN_MATCH_SCORE,
} from '../src/services/matching';

function makeProfile(overrides: Partial<MatcherProfile> = {}): MatcherProfile {
  return {
    id: 'user-a',
    displayName: 'User A',
    skills: [],
    university: null,
    days: [],
    dayParts: [],
    format: 'EITHER',
    ...overrides,
  };
}

function skill(name: string, type: 'TEACH' | 'WANT', level = 'INTERMEDIATE') {
  return { id: name, name, type, level };
}

describe('matching engine', () => {
  it('gives a perfect reciprocal match (100) for complementary users', () => {
    const a = makeProfile({
      skills: [skill('Python', 'TEACH'), skill('Photoshop', 'WANT')],
      university: 'University of Lagos',
      days: ['Mon', 'Sat'],
      dayParts: ['Evening'],
      format: 'ONLINE',
    });
    const b = makeProfile({
      id: 'user-b',
      displayName: 'User B',
      skills: [skill('Photoshop', 'TEACH', 'EXPERT'), skill('Python', 'WANT')],
      university: 'University of Lagos',
      days: ['Sat', 'Sun'],
      dayParts: ['Evening'],
      format: 'ONLINE',
    });
    const match = calculateMatchScore(a, b);
    expect(match.score).toBe(100);
    expect(match.category).toBe('PERFECT');
    expect(match.explanation.youWantTheyTeach).toEqual(['Photoshop']);
    expect(match.explanation.theyWantYouTeach).toEqual(['Python']);
    expect(match.explanation.sameUniversity).toBe(true);
    expect(match.explanation.sharedDays).toEqual(['Sat']);
    expect(match.explanation.sharedDayParts).toEqual(['Evening']);
    expect(match.explanation.formatCompatible).toBe(true);
    expect(match.youTeach).toEqual(['Python']);
    expect(match.theyTeach).toEqual(['Photoshop']);
  });

  it('is symmetric: score(A,B) equals score(B,A)', () => {
    const a = makeProfile({
      skills: [skill('Python', 'TEACH'), skill('Figma', 'WANT')],
      university: 'Uni A',
      days: ['Mon'],
      dayParts: ['Evening'],
      format: 'ONLINE',
    });
    const b = makeProfile({
      id: 'user-b',
      skills: [skill('Figma', 'TEACH'), skill('Python', 'WANT')],
      university: 'Uni A',
      days: ['Mon'],
      dayParts: ['Evening'],
      format: 'ONLINE',
    });
    expect(calculateMatchScore(a, b).score).toBe(calculateMatchScore(b, a).score);
  });

  it('scores a one-way match at 50 (they teach what you want, but no reverse)', () => {
    const a = makeProfile({ skills: [skill('Photoshop', 'WANT')], format: 'ONLINE' });
    const b = makeProfile({ id: 'b', skills: [skill('Photoshop', 'TEACH')], format: 'IN_PERSON' });
    const match = calculateMatchScore(a, b);
    expect(match.score).toBe(50);
    expect(match.breakdown.reciprocalTeach).toBe(50);
    expect(match.breakdown.reverseTeach).toBe(0);
    expect(match.category).toBe('POTENTIAL');
  });

  it('scores the reverse direction at 30 (you teach what they want only)', () => {
    const a = makeProfile({ skills: [skill('Python', 'TEACH')], format: 'ONLINE' });
    const b = makeProfile({ id: 'b', skills: [skill('Python', 'WANT')], format: 'IN_PERSON' });
    const match = calculateMatchScore(a, b);
    expect(match.score).toBe(30);
    expect(match.category).toBe('LOW');
    expect(isRecommended(match)).toBe(false);
  });

  it('adds 10 for the same university', () => {
    const a = makeProfile({ university: 'Uni X', skills: [skill('Python', 'WANT')] });
    const b = makeProfile({ id: 'b', university: 'Uni X', skills: [skill('Python', 'TEACH')] });
    expect(calculateMatchScore(a, b).breakdown.sameUniversity).toBe(10);
    const c = makeProfile({ id: 'c', university: 'Uni Y', skills: [skill('Python', 'TEACH')] });
    expect(calculateMatchScore(a, c).breakdown.sameUniversity).toBe(0);
  });

  it('adds 5 for compatible availability (shared day AND day-part)', () => {
    const base = {
      university: 'U',
      skills: [skill('Python', 'WANT')],
      days: ['Mon'],
      dayParts: ['Evening'],
    };
    const a = makeProfile(base);
    const b = makeProfile({
      id: 'b',
      university: 'U',
      skills: [skill('Python', 'TEACH')],
      days: ['Mon', 'Tue'],
      dayParts: ['Evening'],
    });
    expect(calculateMatchScore(a, b).breakdown.availability).toBe(5);

    const c = makeProfile({
      id: 'c',
      university: 'U',
      skills: [skill('Python', 'TEACH')],
      days: ['Mon'],
      dayParts: ['Morning'],
    });
    // shares a day but not a day-part
    expect(calculateMatchScore(a, c).breakdown.availability).toBe(0);
  });

  it('adds 5 for compatible formats, including EITHER', () => {
    const a = makeProfile({ format: 'ONLINE', skills: [skill('Python', 'WANT')] });
    const b = makeProfile({
      id: 'b',
      format: 'ONLINE',
      university: 'U',
      skills: [skill('Python', 'TEACH')],
    });
    expect(calculateMatchScore(a, b).breakdown.format).toBe(5);

    const c = makeProfile({
      id: 'c',
      format: 'EITHER',
      university: 'U',
      skills: [skill('Python', 'TEACH')],
    });
    expect(calculateMatchScore(a, c).breakdown.format).toBe(5);

    const d = makeProfile({
      id: 'd',
      format: 'IN_PERSON',
      university: 'U',
      skills: [skill('Python', 'TEACH')],
    });
    expect(calculateMatchScore(a, d).breakdown.format).toBe(0);
    expect(calculateMatchScore(a, d).score).toBe(50); // only the 50pt reciprocal teach
  });

  it('gives 0 for users with nothing in common and does not recommend them', () => {
    const a = makeProfile({ skills: [skill('Python', 'TEACH')], format: 'ONLINE' });
    const b = makeProfile({ id: 'b', skills: [skill('Guitar', 'TEACH')], format: 'IN_PERSON' });
    const match = calculateMatchScore(a, b);
    expect(match.score).toBe(0);
    expect(match.category).toBe('LOW');
    expect(isRecommended(match)).toBe(false);
  });

  it('respects the 40-point recommendation threshold', () => {
    expect(MIN_MATCH_SCORE).toBe(40);
    const a = makeProfile({ skills: [skill('Python', 'WANT')] });
    const b = makeProfile({ id: 'b', skills: [skill('Python', 'TEACH')] });
    expect(isRecommended(calculateMatchScore(a, b))).toBe(true); // 50
    expect(isRecommended(calculateMatchScore(b, a))).toBe(false); // 30
  });

  it('classifies categories: PERFECT >= 80, STRONG >= 60, POTENTIAL >= 40', () => {
    const a = makeProfile({
      skills: [skill('P', 'TEACH'), skill('Q', 'WANT')],
      university: 'U', days: ['Mon'], dayParts: ['Eve'], format: 'ONLINE',
    });
    const perfect = makeProfile({
      id: 'b', skills: [skill('Q', 'TEACH'), skill('P', 'WANT')],
      university: 'U', days: ['Mon'], dayParts: ['Eve'], format: 'ONLINE',
    });
    expect(calculateMatchScore(a, perfect).category).toBe('PERFECT');

    // 50 (they teach Q, which A wants) + 10 (same university) + 0 (incompatible format) = 60 → STRONG
    const strong = makeProfile({
      id: 'c', skills: [skill('Q', 'TEACH')],
      university: 'U', days: ['Tue'], dayParts: ['Morning'], format: 'IN_PERSON',
    });
    expect(calculateMatchScore(a, strong).category).toBe('STRONG');
    expect(calculateMatchScore(a, strong).score).toBe(60);
  });
});
