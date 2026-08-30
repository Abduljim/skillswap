import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SKILLS: Array<[string, string]> = [
  // Technology
  ['Python', 'Technology'], ['JavaScript', 'Technology'], ['Java', 'Technology'],
  ['C', 'Technology'], ['C++', 'Technology'], ['React', 'Technology'],
  ['SQL', 'Technology'], ['Git', 'Technology'], ['Cybersecurity', 'Technology'],
  ['Data Analysis', 'Technology'], ['Machine Learning', 'Technology'], ['Excel', 'Technology'],
  // Design
  ['Photoshop', 'Design'], ['Figma', 'Design'], ['Illustrator', 'Design'],
  ['Canva', 'Design'], ['UI Design', 'Design'], ['UX Design', 'Design'],
  ['Motion Design', 'Design'], ['Branding', 'Design'],
  // Academic
  ['Mathematics', 'Academic'], ['Physics', 'Academic'], ['Statistics', 'Academic'],
  ['Research Writing', 'Academic'],
  // Creative
  ['Photography', 'Creative'], ['Video Editing', 'Creative'], ['Drawing', 'Creative'],
  ['Animation', 'Creative'], ['Writing', 'Creative'], ['Content Creation', 'Creative'],
  // Business
  ['Marketing', 'Business'], ['Sales', 'Business'], ['Accounting', 'Business'],
  ['Entrepreneurship', 'Business'], ['Public Speaking', 'Business'],
  // Languages
  ['French', 'Languages'], ['Spanish', 'Languages'], ['English Writing', 'Languages'],
  ['Yoruba', 'Languages'], ['Arabic', 'Languages'],
  // Lifestyle
  ['Cooking', 'Lifestyle'], ['Fitness', 'Lifestyle'], ['Sewing', 'Lifestyle'],
  ['Hair Styling', 'Lifestyle'], ['Makeup', 'Lifestyle'],
  // Music
  ['Guitar', 'Music'], ['Piano', 'Music'], ['Music Production', 'Music'], ['Singing', 'Music'],
  // Communication
  ['Debating', 'Communication'], ['Negotiation', 'Communication'], ['Storytelling', 'Communication'],
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PARTS = ['Morning', 'Afternoon', 'Evening'];

interface SeedUser {
  email: string;
  displayName: string;
  university?: string;
  department?: string;
  year?: string;
  bio?: string;
  format?: 'ONLINE' | 'IN_PERSON' | 'EITHER';
  days?: string[];
  dayParts?: string[];
  teaches: Array<[string, 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT']>;
  wants: string[];
}

const USERS: SeedUser[] = [
  {
    email: 'david@example.com', displayName: 'David Adeyemi',
    university: 'University of Lagos', department: 'Computer Science', year: '300',
    bio: 'Backend developer who loves clean code and teaching people to think in algorithms.',
    format: 'EITHER', days: ['Mon', 'Wed', 'Sat'], dayParts: ['Evening'],
    teaches: [['Python', 'ADVANCED'], ['SQL', 'INTERMEDIATE']], wants: ['Figma', 'UI Design'],
  },
  {
    email: 'sarah@example.com', displayName: 'Sarah Okafor',
    university: 'University of Lagos', department: 'Mass Communication', year: '200',
    bio: 'I enjoy helping people understand design and visual communication.',
    format: 'EITHER', days: ['Tue', 'Thu', 'Sat'], dayParts: ['Evening'],
    teaches: [['Figma', 'EXPERT'], ['Photoshop', 'ADVANCED'], ['UI Design', 'ADVANCED']],
    wants: ['Python', 'Video Editing'],
  },
  {
    email: 'amaka@example.com', displayName: 'Amaka Eze',
    university: 'University of Nigeria', department: 'Fine and Applied Arts', year: '300',
    bio: 'Illustrator by day, photographer by golden hour.',
    format: 'ONLINE', days: ['Sat', 'Sun'], dayParts: ['Afternoon'],
    teaches: [['Illustrator', 'EXPERT'], ['Drawing', 'ADVANCED'], ['Photography', 'INTERMEDIATE']],
    wants: ['Photoshop', 'Marketing'],
  },
  {
    email: 'tunde@example.com', displayName: 'Tunde Bakare',
    university: 'University of Ibadan', department: 'Economics', year: '400',
    bio: 'Numbers person. I can make Excel dance.',
    format: 'EITHER', days: ['Mon', 'Tue', 'Fri'], dayParts: ['Morning', 'Evening'],
    teaches: [['Excel', 'EXPERT'], ['Data Analysis', 'ADVANCED'], ['Accounting', 'INTERMEDIATE']],
    wants: ['Photography', 'Guitar'],
  },
  {
    email: 'zainab@example.com', displayName: 'Zainab Musa',
    university: 'Ahmadu Bello University', department: 'French', year: '300',
    bio: 'Language lover — French and Arabic tutor with 4 years of peer teaching.',
    format: 'ONLINE', days: ['Tue', 'Thu', 'Sun'], dayParts: ['Evening'],
    teaches: [['French', 'EXPERT'], ['Arabic', 'INTERMEDIATE']],
    wants: ['Python', 'React'],
  },
  {
    email: 'chinedu@example.com', displayName: 'Chinedu Obi',
    university: 'University of Nigeria', department: 'Mechanical Engineering', year: '400',
    bio: 'Maker, tinkerer, guitarist.',
    format: 'IN_PERSON', days: ['Sat', 'Sun'], dayParts: ['Morning', 'Afternoon'],
    teaches: [['Guitar', 'ADVANCED'], ['Physics', 'INTERMEDIATE']],
    wants: ['Excel', 'Data Analysis'],
  },
  {
    email: 'fatima@example.com', displayName: 'Fatima Bello',
    university: 'Ahmadu Bello University', department: 'Computer Science', year: '200',
    bio: 'Frontend developer learning to speak in public without shaking.',
    format: 'ONLINE', days: ['Mon', 'Thu', 'Fri'], dayParts: ['Evening'],
    teaches: [['React', 'ADVANCED'], ['JavaScript', 'ADVANCED'], ['Git', 'INTERMEDIATE']],
    wants: ['Public Speaking', 'UI Design'],
  },
  {
    email: 'emeka@example.com', displayName: 'Emeka Nwosu',
    university: 'University of Lagos', department: 'Business Administration', year: '300',
    bio: 'Marketing nerd who runs two small brands.',
    format: 'EITHER', days: ['Wed', 'Sat', 'Sun'], dayParts: ['Afternoon'],
    teaches: [['Marketing', 'ADVANCED'], ['Sales', 'INTERMEDIATE'], ['Entrepreneurship', 'INTERMEDIATE']],
    wants: ['Python', 'Data Analysis'],
  },
  {
    email: 'ngozi@example.com', displayName: 'Ngozi Umeh',
    university: 'University of Ibadan', department: 'Library Science', year: '200',
    bio: 'Professional organizer of information and recipe collector.',
    format: 'ONLINE', days: ['Tue', 'Sat'], dayParts: ['Morning'],
    teaches: [['Research Writing', 'ADVANCED'], ['English Writing', 'EXPERT'], ['Cooking', 'INTERMEDIATE']],
    wants: ['Canva', 'Content Creation'],
  },
  {
    email: 'ibrahim@example.com', displayName: 'Ibrahim Sule',
    university: 'Ahmadu Bello University', department: 'Statistics', year: '400',
    bio: 'I dream in distributions.',
    format: 'EITHER', days: ['Mon', 'Wed', 'Fri'], dayParts: ['Evening'],
    teaches: [['Statistics', 'EXPERT'], ['Machine Learning', 'ADVANCED'], ['Python', 'INTERMEDIATE']],
    wants: ['Public Speaking', 'French'],
  },
  {
    email: 'tolu@example.com', displayName: 'Tolu Ajayi',
    university: 'University of Lagos', department: 'Music', year: '200',
    bio: 'Piano teacher who wants to finally understand code.',
    format: 'EITHER', days: ['Thu', 'Sat', 'Sun'], dayParts: ['Afternoon', 'Evening'],
    teaches: [['Piano', 'EXPERT'], ['Music Production', 'ADVANCED'], ['Singing', 'INTERMEDIATE']],
    wants: ['JavaScript', 'React'],
  },
  {
    email: 'bose@example.com', displayName: 'Bose Ade',
    university: 'University of Ibadan', department: 'Theatre Arts', year: '300',
    bio: 'Stage presence for days. Let me help you love the mic.',
    format: 'IN_PERSON', days: ['Fri', 'Sat', 'Sun'], dayParts: ['Evening'],
    teaches: [['Public Speaking', 'EXPERT'], ['Storytelling', 'ADVANCED'], ['Debating', 'ADVANCED']],
    wants: ['Video Editing', 'Figma'],
  },
  {
    email: 'kemi@example.com', displayName: 'Kemi Lawal',
    university: 'Ahmadu Bello University', department: 'Computer Science', year: '400',
    bio: 'Cybersecurity enthusiast and CTF player.',
    format: 'ONLINE', days: ['Tue', 'Wed', 'Sat'], dayParts: ['Evening'],
    teaches: [['Cybersecurity', 'ADVANCED'], ['C++', 'INTERMEDIATE'], ['Java', 'INTERMEDIATE']],
    wants: ['Makeup', 'Fitness'],
  },
  {
    email: 'ada@example.com', displayName: 'Ada Obi',
    university: 'University of Nigeria', department: 'Home Economics', year: '200',
    bio: 'If it involves fabric or food, I am in.',
    format: 'IN_PERSON', days: ['Mon', 'Sat'], dayParts: ['Morning', 'Afternoon'],
    teaches: [['Sewing', 'EXPERT'], ['Cooking', 'ADVANCED'], ['Hair Styling', 'INTERMEDIATE']],
    wants: ['Excel', 'Entrepreneurship'],
  },
  {
    email: 'ayo@example.com', displayName: 'Ayo Oladipo',
    university: 'University of Ibadan', department: 'Computer Science', year: '500',
    bio: 'Finalist. Data nerd. Amateur cook with strong opinions about jollof.',
    format: 'EITHER', days: ['Mon', 'Tue', 'Sun'], dayParts: ['Evening'],
    teaches: [['Python', 'EXPERT'], ['Machine Learning', 'INTERMEDIATE'], ['Cooking', 'BEGINNER']],
    wants: ['Photoshop', 'Video Editing'],
  },
  {
    email: 'halima@example.com', displayName: 'Halima Yusuf',
    university: 'Ahmadu Bello University', department: 'Architecture', year: '300',
    bio: 'Designing buildings by day, learning motion graphics by night.',
    format: 'EITHER', days: ['Wed', 'Thu', 'Sun'], dayParts: ['Afternoon'],
    teaches: [['Branding', 'INTERMEDIATE'], ['Canva', 'EXPERT'], ['Mathematics', 'INTERMEDIATE']],
    wants: ['Drawing', 'Motion Design'],
  },
  {
    email: 'seun@example.com', displayName: 'Seun Afolabi',
    university: 'University of Lagos', department: 'Mass Communication', year: '400',
    bio: 'Video editor with 5 years of YouTube experience.',
    format: 'ONLINE', days: ['Fri', 'Sat', 'Sun'], dayParts: ['Evening'],
    teaches: [['Video Editing', 'EXPERT'], ['Content Creation', 'ADVANCED'], ['Writing', 'INTERMEDIATE']],
    wants: ['UI Design', 'French'],
  },
  {
    email: 'uche@example.com', displayName: 'Uche Eze',
    university: 'University of Nigeria', department: 'Accounting', year: '400',
    bio: 'Accountant who wishes someone taught him design in school.',
    format: 'ONLINE', days: ['Mon', 'Thu'], dayParts: ['Morning'],
    teaches: [['Accounting', 'EXPERT'], ['Sales', 'ADVANCED']],
    wants: ['Figma', 'Photoshop'],
  },
  {
    email: 'hauwa@example.com', displayName: 'Hauwa Garba',
    university: 'Ahmadu Bello University', department: 'English', year: '200',
    bio: 'Words are my thing. Teach me spreadsheets, please.',
    format: 'EITHER', days: ['Tue', 'Sat', 'Sun'], dayParts: ['Evening'],
    teaches: [['English Writing', 'ADVANCED'], ['Storytelling', 'ADVANCED'], ['Yoruba', 'INTERMEDIATE']],
    wants: ['Excel', 'SQL'],
  },
  {
    email: 'fejiro@example.com', displayName: 'Fejiro Oghenekaro',
    university: 'University of Ibadan', department: 'Pharmacy', year: '500',
    bio: 'Fitness enthusiast balancing pharmacy school and the gym.',
    format: 'IN_PERSON', days: ['Mon', 'Wed', 'Sat'], dayParts: ['Morning'],
    teaches: [['Fitness', 'EXPERT'], ['Makeup', 'INTERMEDIATE']],
    wants: ['Python', 'Data Analysis'],
  },
];

async function main() {
  console.log('Seeding SkillSwap...');
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.message.deleteMany();
  await prisma.session.deleteMany();
  await prisma.exchange.deleteMany();
  await prisma.exchangeRequest.deleteMany();
  await prisma.userSkill.deleteMany();
  await prisma.block.deleteMany();
  await prisma.report.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();

  const skills: Record<string, string> = {};
  for (const [name, category] of SKILLS) {
    const skill = await prisma.skill.create({ data: { name, category } });
    skills[name] = skill.id;
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  const users: Record<string, string> = {};

  const admin = await prisma.user.create({
    data: {
      email: 'admin@skillswap.app',
      passwordHash,
      displayName: 'SkillSwap Admin',
      role: 'ADMIN',
      profile: { create: { bio: 'Keeping the community safe.' } },
    },
  });
  users['admin'] = admin.id;

  for (const u of USERS) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash,
        displayName: u.displayName,
        profile: {
          create: {
            bio: u.bio,
            university: u.university,
            department: u.department,
            year: u.year,
            format: u.format || 'EITHER',
            days: u.days || DAYS.slice(0, 3),
            dayParts: u.dayParts || ['Evening'],
            avatarColor: ['coral', 'mint', 'lavender', 'ink'][
              Math.floor(Math.random() * 4)
            ],
          },
        },
      },
    });
    users[u.email] = user.id;
    for (const [name, level] of u.teaches) {
      await prisma.userSkill.create({
        data: { userId: user.id, skillId: skills[name], type: 'TEACH', level },
      });
    }
    for (const name of u.wants) {
      await prisma.userSkill.create({
        data: { userId: user.id, skillId: skills[name], type: 'WANT', level: 'BEGINNER' },
      });
    }
  }

  // Demo activity: David <-> Sarah active exchange
  const david = users['david@example.com'];
  const sarah = users['sarah@example.com'];
  const request = await prisma.exchangeRequest.create({
    data: {
      senderId: david,
      recipientId: sarah,
      message:
        "Hi Sarah, I noticed you can teach Figma, and I'm currently learning it. I can teach you Python in return. Would you like to exchange skills?",
      skillOffered: 'Python',
      skillWanted: 'Figma',
      status: 'ACCEPTED',
    },
  });
  const exchange = await prisma.exchange.create({
    data: {
      userAId: david,
      userBId: sarah,
      skillATeaches: 'Python',
      skillBTeaches: 'Figma',
      requestId: request.id,
    },
  });
  await prisma.message.createMany({
    data: [
      { exchangeId: exchange.id, senderId: david, content: 'Hi Sarah! Excited for this swap.' },
      { exchangeId: exchange.id, senderId: sarah, content: 'Me too! When do we start?' },
      { exchangeId: exchange.id, senderId: david, content: 'Saturday evening works for me.' },
    ],
  });
  await prisma.session.create({
    data: {
      exchangeId: exchange.id,
      createdBy: david,
      title: 'Python basics — variables & loops',
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      durationMinutes: 60,
      mode: 'ONLINE',
      meetingLink: 'https://meet.example.com/python-basics',
      notes: 'Bring a laptop with Python installed.',
    },
  });
  await prisma.session.create({
    data: {
      exchangeId: exchange.id,
      createdBy: david,
      title: 'Python session #1',
      scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      durationMinutes: 60,
      mode: 'ONLINE',
      status: 'COMPLETED',
    },
  });

  // Completed exchange with reviews (Tunde <-> Amaka)
  const amaka = users['amaka@example.com'];
  const tunde = users['tunde@example.com'];
  const req2 = await prisma.exchangeRequest.create({
    data: {
      senderId: tunde,
      recipientId: amaka,
      message: 'I can teach you Excel if you teach me Photography!',
      skillOffered: 'Excel',
      skillWanted: 'Photography',
      status: 'ACCEPTED',
    },
  });
  const completed = await prisma.exchange.create({
    data: {
      userAId: tunde,
      userBId: amaka,
      skillATeaches: 'Excel',
      skillBTeaches: 'Photography',
      status: 'COMPLETED',
      completeA: true,
      completeB: true,
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      requestId: req2.id,
    },
  });
  await prisma.review.createMany({
    data: [
      {
        exchangeId: completed.id,
        reviewerId: tunde,
        revieweeId: amaka,
        rating: 5,
        comment:
          'Amaka explained composition so clearly and was patient throughout our sessions.',
      },
      {
        exchangeId: completed.id,
        reviewerId: amaka,
        revieweeId: tunde,
        rating: 5,
        comment: 'Tunde turned me into the Excel person of my department. Highly recommended!',
      },
    ],
  });
  await prisma.user.update({ where: { id: tunde }, data: { completedCount: { increment: 1 } } });
  await prisma.user.update({ where: { id: amaka }, data: { completedCount: { increment: 1 } } });

  // ------------------------------------------------------------------
  // Monetization catalogue (prices are configurable; Play is source of
  // truth at checkout).
  // ------------------------------------------------------------------
  const plans = [
    { tier: 'GOLD' as const, billingPeriod: 'MONTHLY' as const, googleProductId: 'skillswap_gold_monthly', displayPrice: '₦1,500' },
    { tier: 'GOLD' as const, billingPeriod: 'YEARLY' as const, googleProductId: 'skillswap_gold_yearly', displayPrice: '₦12,000' },
    { tier: 'ELITE' as const, billingPeriod: 'MONTHLY' as const, googleProductId: 'skillswap_elite_monthly', displayPrice: '₦3,500' },
    { tier: 'ELITE' as const, billingPeriod: 'YEARLY' as const, googleProductId: 'skillswap_elite_yearly', displayPrice: '₦28,000' },
  ];
  for (const plan of plans) {
    await prisma.subscriptionProduct.upsert({
      where: { googleProductId: plan.googleProductId },
      create: plan,
      update: { displayPrice: plan.displayPrice },
    });
  }

  const boosts = [
    {
      name: 'Match Boost',
      description: 'Appear higher in relevant discovery results for 24 hours.',
      type: 'MATCH_BOOST' as const,
      durationHours: 24,
      price: 30000,
      googleProductId: 'skillswap_match_boost',
    },
    {
      name: 'Spotlight',
      description: 'Feature your profile prominently to people searching for your skills.',
      type: 'SPOTLIGHT' as const,
      durationHours: 24,
      price: 50000,
      googleProductId: 'skillswap_spotlight',
    },
    {
      name: 'Weekly Spotlight',
      description: 'Feature your profile prominently for a full week.',
      type: 'WEEKLY_SPOTLIGHT' as const,
      durationHours: 24 * 7,
      price: 250000,
      googleProductId: 'skillswap_weekly_spotlight',
    },
  ];
  for (const boost of boosts) {
    await prisma.boostProduct.upsert({
      where: { googleProductId: boost.googleProductId },
      create: boost,
      update: { price: boost.price, description: boost.description },
    });
  }

  // Demo: Sarah is a Gold member so the premium visuals are visible.
  const sarahId = users['sarah@example.com'];
  if (sarahId) {
    const goldMonthly = await prisma.subscriptionProduct.findUnique({
      where: { googleProductId: 'skillswap_gold_monthly' },
    });
    if (goldMonthly) {
      await prisma.subscription.upsert({
        where: { purchaseToken: 'seed-sarah-gold-demo' },
        create: {
          userId: sarahId,
          tier: 'GOLD',
          status: 'ACTIVE',
          provider: 'GOOGLE_PLAY',
          productId: goldMonthly.id,
          purchaseToken: 'seed-sarah-gold-demo',
          startedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
          expiresAt: new Date(Date.now() + 25 * 24 * 3600 * 1000),
          autoRenew: true,
        },
        update: {},
      });
    }
  }

  console.log(
    `Seeded ${SKILLS.length} skills, ${USERS.length + 1} users, demo exchanges, sessions, messages, reviews and the monetization catalogue.`
  );
  console.log('Demo login: david@example.com / password123 (admin: admin@skillswap.app / password123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
