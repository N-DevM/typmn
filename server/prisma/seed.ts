import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const quotes = [
  // EASY (difficulty 1) - Common words, short sentences
  { text: "The sun rose over the hills and the birds started to sing their morning songs. A gentle breeze blew through the trees and the leaves rustled softly. The flowers in the garden were blooming with bright colors of red, yellow, and purple. It was a beautiful day to go outside and enjoy the fresh air. The children ran out to play in the park while their parents watched from the bench. They played on the swings and slides and laughed with joy. A small dog ran alongside them, barking happily. The sky was clear and blue with just a few white clouds floating by. Everyone was smiling and feeling grateful for such a wonderful morning. This is what makes life worth living, the simple moments of peace and happiness that we often take for granted in our busy everyday lives.", source: "Nature Story", difficulty: 1, category: "general", wordCount: 140 },
  { text: "Learning to type fast is one of the most useful skills you can develop in the modern world. Whether you are writing emails, coding software, or chatting with friends, the ability to type quickly and accurately will save you hours of time every single day. The key to getting better is consistent practice. Start with short sessions of fifteen minutes each day and gradually increase the duration as you get more comfortable. Focus on accuracy first and speed will follow naturally over time. Keep your fingers on the home row keys and try not to look at the keyboard while you type. It may feel slow at first but with patience and dedication you will see dramatic improvement within just a few weeks of regular practice sessions.", source: "Typing Guide", difficulty: 1, category: "general", wordCount: 132 },
  { text: "Cooking is an art that anyone can learn with a little bit of practice and patience. Start with simple recipes that have just a few ingredients and follow the steps one at a time. Always read the entire recipe before you begin so you know what to expect. Make sure you have all the ingredients ready before you start cooking. This is called preparing your station. Chop your vegetables, measure your spices, and have your pots and pans ready to go. When you cook with love and care the food always tastes better. Do not be afraid to make mistakes because that is how you learn and grow as a cook. Share your food with family and friends and watch their faces light up with each delicious bite you serve them at the dinner table.", source: "Cooking Tips", difficulty: 1, category: "general", wordCount: 138 },
  { text: "Reading books is one of the best habits you can develop for your personal growth and development. Books open up new worlds and help you see things from different perspectives. Whether you enjoy fiction or non-fiction there is something for everyone. Try to read at least twenty minutes every day. You can read before bed, during your lunch break, or while waiting for an appointment. The more you read the better your vocabulary will become and your writing skills will naturally improve as well. Many successful people credit their love of reading as a key factor in their achievements. Start with topics that interest you and gradually explore new genres. Join a book club or discuss books with friends to make reading even more enjoyable and rewarding.", source: "Reading Habits", difficulty: 1, category: "general", wordCount: 132 },
  { text: "Staying healthy requires a combination of good nutrition, regular exercise, and adequate sleep. Try to eat a balanced diet that includes plenty of fruits, vegetables, whole grains, and lean proteins. Drink at least eight glasses of water every day to stay properly hydrated. Exercise for at least thirty minutes a day, five days a week. This can include walking, jogging, swimming, or any activity that gets your heart rate up and makes you sweat. Sleep is equally important for your overall health. Most adults need seven to eight hours of quality sleep each night to function at their best. Avoid looking at screens right before bed and create a relaxing nighttime routine. Taking care of your health today will pay dividends for many years to come in the future.", source: "Health Tips", difficulty: 1, category: "general", wordCount: 136 },

  // MEDIUM (difficulty 2) - Longer sentences, varied vocabulary
  { text: "The evolution of technology has fundamentally transformed the way we live, work, and communicate with one another. Just a few decades ago, the idea of carrying a powerful computer in your pocket seemed like science fiction, yet today smartphones are an integral part of daily life for billions of people around the world. Cloud computing has revolutionized how businesses operate, enabling small startups to access the same powerful tools that were once exclusive to large corporations. Artificial intelligence and machine learning algorithms are now capable of performing tasks that previously required human intelligence, from diagnosing medical conditions to translating languages in real time. The pace of technological advancement shows no signs of slowing down, and experts predict that the next decade will bring even more groundbreaking innovations that will reshape entire industries and create new opportunities that we cannot yet imagine or fully comprehend.", source: "Technology Essay", difficulty: 2, category: "technology", wordCount: 148 },
  { text: "The human brain is perhaps the most complex structure in the known universe. Containing approximately one hundred billion neurons, each capable of forming thousands of connections with other neurons, the brain creates an intricate network that gives rise to consciousness, thought, emotion, and memory. Despite decades of research, neuroscientists have only scratched the surface of understanding how this remarkable organ operates. The brain consumes about twenty percent of the body's total energy despite accounting for only two percent of its mass. During sleep, far from being idle, the brain actively consolidates memories, processes emotions, and performs essential maintenance functions. Recent advances in neuroimaging technology have allowed researchers to observe brain activity in unprecedented detail, revealing patterns of neural communication that challenge long-held assumptions about how different regions of the brain work together to produce the rich tapestry of human experience and behavior.", source: "Neuroscience", difficulty: 2, category: "science", wordCount: 147 },
  { text: "The art of writing clean and maintainable code is something that distinguishes great software engineers from good ones. Clean code is not just about making things work; it is about writing programs that other developers can easily understand, modify, and extend. This means choosing descriptive variable names, keeping functions short and focused on a single task, and organizing code in a logical structure that follows established patterns and conventions. Comments should explain the reasoning behind complex decisions rather than simply restating what the code does. Regular code reviews with team members help identify potential improvements and share knowledge across the development team. Testing is equally important, with unit tests ensuring individual components behave correctly and integration tests verifying that different parts of the system work together harmoniously. The investment in writing clean code pays significant dividends over time by reducing debugging effort and making future feature development substantially easier and faster.", source: "Software Engineering", difficulty: 2, category: "code", wordCount: 155 },
  { text: "Pakistan has a rich and diverse cultural heritage that spans thousands of years of human civilization. From the ancient Indus Valley civilization, one of the world's oldest urban cultures, to the magnificent Mughal architecture found in cities like Lahore and Multan, the country is a treasure trove of historical wonders. The Badshahi Mosque, Shalimar Gardens, and Lahore Fort stand as testaments to the artistic and architectural brilliance of past empires. Pakistani cuisine is equally diverse, with each region offering its own distinctive flavors and specialties. From the spicy biryani of Sindh to the succulent chapli kebabs of Peshawar, the food reflects the country's multicultural roots. The country's natural beauty ranges from the towering peaks of the Karakoram and Himalayan mountain ranges to the pristine beaches of the Arabian Sea coast. Pakistan's people are known for their warmth, hospitality, and resilience in the face of challenges, making it a truly remarkable nation.", source: "Pakistan Culture", difficulty: 2, category: "general", wordCount: 162 },
  { text: "Effective time management is a crucial skill that can dramatically improve both your professional productivity and personal satisfaction. The key principle behind good time management is not about doing more things, but about focusing on the right things at the right time. One of the most popular techniques is the Pomodoro method, where you work in focused twenty-five minute intervals followed by short five-minute breaks. This approach helps maintain concentration while preventing mental fatigue. Another important strategy is prioritization, which involves identifying the most important and urgent tasks and tackling them first when your energy levels are highest. Many people find it helpful to plan their day the night before, creating a clear roadmap of what needs to be accomplished. It is also essential to learn to say no to requests that do not align with your priorities and to eliminate or delegate tasks that do not require your personal attention. Remember that rest and recreation are not luxuries but essential components of sustainable productivity.", source: "Productivity", difficulty: 2, category: "general", wordCount: 164 },

  // HARD (difficulty 3) - Complex vocabulary, longer paragraphs, technical terms
  { text: "The intersection of quantum computing and artificial intelligence represents one of the most promising and potentially transformative technological frontiers of the twenty-first century. While classical computers process information using bits that exist in binary states of zero or one, quantum computers leverage the principles of quantum mechanics, specifically superposition and entanglement, to process information using quantum bits or qubits that can exist in multiple states simultaneously. This fundamental difference enables quantum computers to perform certain types of calculations exponentially faster than their classical counterparts. When applied to machine learning algorithms, quantum computing could dramatically accelerate the training of deep neural networks, enable the processing of vastly larger datasets, and solve optimization problems that are currently intractable for classical systems. Researchers at leading institutions and technology companies are actively developing quantum machine learning algorithms that could revolutionize fields ranging from drug discovery and materials science to financial modeling and cryptographic security, potentially ushering in a new era of computational capability.", source: "Quantum Computing", difficulty: 3, category: "technology", wordCount: 156 },
  { text: "The philosophical implications of artificial general intelligence challenge our fundamental understanding of consciousness, personhood, and moral responsibility. Unlike narrow artificial intelligence systems that excel at specific tasks such as image recognition or language translation, artificial general intelligence would possess the ability to understand, learn, and apply knowledge across diverse domains in a manner comparable to human cognition. This raises profound ethical questions about the nature of machine consciousness and whether an artificial entity that demonstrates self-awareness, emotional responses, and autonomous decision-making should be accorded rights similar to those of biological sentient beings. Furthermore, the development of superintelligent systems that surpass human cognitive capabilities across all domains presents existential risks that philosophers, ethicists, and policymakers are only beginning to grapple with. The alignment problem, ensuring that artificial intelligence systems pursue goals that are beneficial to humanity rather than potentially destructive ones, remains one of the most critical challenges facing the field of artificial intelligence research and development in the contemporary era.", source: "AI Philosophy", difficulty: 3, category: "technology", wordCount: 162 },
  { text: "The implementation of distributed microservices architecture requires a comprehensive understanding of multiple interconnected concepts including service discovery, load balancing, circuit breaking, and eventual consistency in distributed data management. Unlike monolithic applications where all components share a single process and database, microservices decompose complex systems into independently deployable services that communicate through well-defined application programming interfaces and asynchronous messaging protocols. Each service encapsulates its own business logic, maintains its own data store, and can be developed, tested, deployed, and scaled independently of other services in the ecosystem. Container orchestration platforms such as Kubernetes have become essential tools for managing the operational complexity of microservices deployments, providing automated scaling, self-healing capabilities, service mesh integration, and declarative configuration management. However, the transition from monolithic to microservices architecture introduces significant challenges including increased network latency, data consistency across service boundaries, distributed tracing and debugging complexity, and the organizational shift toward cross-functional autonomous teams that own their services throughout the entire software development lifecycle.", source: "System Architecture", difficulty: 3, category: "code", wordCount: 165 },
  { text: "The Renaissance period, spanning approximately from the fourteenth to the seventeenth century, marked a profound cultural and intellectual transformation that originated in Italy before spreading throughout Europe. This era witnessed an extraordinary flourishing of art, literature, philosophy, science, and political thought that fundamentally altered the trajectory of Western civilization. The movement was characterized by a renewed interest in the classical learning of ancient Greece and Rome, a shift toward humanism that placed greater emphasis on individual potential and achievement, and a spirit of inquiry that challenged established dogmas and encouraged empirical investigation. Artists such as Leonardo da Vinci, Michelangelo, and Raphael created masterworks that continue to inspire and astound viewers centuries later, while scientists like Galileo Galilei and Nicolaus Copernicus laid the groundwork for the Scientific Revolution that would follow. The invention of the printing press by Johannes Gutenberg around fourteen forty dramatically accelerated the dissemination of knowledge and ideas, democratizing access to information in a way that transformed education, religion, and political discourse across the European continent.", source: "History", difficulty: 3, category: "general", wordCount: 168 },
  { text: "The discipline of cybersecurity has evolved from a niche technical concern into a critical strategic imperative for organizations of every size and sector. As digital transformation accelerates and the attack surface continues to expand through cloud computing, Internet of Things devices, and remote work infrastructure, the sophistication and frequency of cyber threats have increased dramatically. Advanced persistent threats, ransomware campaigns, supply chain compromises, and social engineering attacks now pose existential risks to businesses, government agencies, and critical infrastructure systems worldwide. Effective cybersecurity requires a multi-layered defense approach that encompasses network security, endpoint protection, identity and access management, data encryption, security information and event management, and comprehensive incident response planning. Equally important is the human element, as security awareness training for employees remains one of the most cost-effective measures for reducing organizational vulnerability to phishing attacks and other forms of social manipulation. The shortage of qualified cybersecurity professionals continues to be a significant challenge, with millions of positions remaining unfilled globally despite growing demand and increasingly competitive compensation packages.", source: "Cybersecurity", difficulty: 3, category: "technology", wordCount: 172 },

  // MORE EASY (difficulty 1) - Additional variety
  { text: "Music has the power to change our mood and bring people together. Whether you listen to pop, rock, classical, or hip hop, music speaks to the heart in ways that words alone cannot. Many people enjoy listening to music while they work, study, or exercise because it helps them focus and stay motivated. Learning to play a musical instrument is a rewarding journey that teaches patience, discipline, and creativity. You do not need to be talented to enjoy making music. Start with something simple like a guitar or keyboard and practice a little bit each day. Music therapy is also used in hospitals and clinics to help patients recover from illness and manage stress. The rhythms and melodies can calm the mind and ease physical pain. From ancient drums to modern digital production, music has always been a fundamental part of human culture and expression across every civilization in recorded history.", source: "Music", difficulty: 1, category: "general", wordCount: 152 },
  { text: "Traveling to new places is one of the most enriching experiences a person can have in their lifetime. When you visit a different country or culture, you gain new perspectives that change the way you think about the world. You learn about different traditions, try new foods, and meet people whose lives are very different from your own. Even traveling within your own country can open your eyes to the diversity and beauty that exists right in your backyard. You do not need a big budget to travel meaningfully. Some of the best trips involve camping in nature, exploring small towns, or volunteering in local communities. The memories you make while traveling stay with you forever and often become the stories you love to share with friends and family. Start planning your next adventure today, even if it is just a day trip to a nearby town you have never visited before.", source: "Travel", difficulty: 1, category: "general", wordCount: 154 },

  // MORE MEDIUM (difficulty 2)
  { text: "The global economy is undergoing a fundamental shift driven by digitalization, automation, and the emergence of new economic models such as the gig economy and platform-based businesses. Traditional employment structures are being disrupted as remote work becomes increasingly normalized and companies recognize the benefits of distributed workforces. The freelance economy has grown substantially, with millions of professionals choosing to work independently rather than in traditional full-time employment arrangements. This transformation has been accelerated by advances in communication technology, project management tools, and cloud-based collaboration platforms that enable seamless teamwork across time zones and geographical boundaries. Financial technology companies are reimagining banking, lending, and payment systems, making financial services more accessible to underserved populations around the world. Cryptocurrency and blockchain technology continue to evolve, with potential applications extending far beyond digital currency to include smart contracts, decentralized finance, supply chain verification, and digital identity management systems.", source: "Economics", difficulty: 2, category: "general", wordCount: 152 },
  { text: "Space exploration has entered a new golden age, driven by both government agencies and private companies that are pushing the boundaries of what is possible beyond our planet. Organizations like SpaceX, Blue Origin, and Rocket Lab have dramatically reduced the cost of launching payloads into orbit through reusable rocket technology, opening up space to a wider range of scientific, commercial, and even tourist activities. NASA's Artemis program aims to return humans to the Moon and establish a sustainable presence there as a stepping stone for eventual crewed missions to Mars. The James Webb Space Telescope has already provided breathtaking images and groundbreaking scientific data about the early universe, exoplanet atmospheres, and the formation of stars and galaxies. Meanwhile, the search for extraterrestrial life continues to intensify, with missions to Europa and Enceladus planned to explore the subsurface oceans of these icy moons where conditions might be favorable for microbial life.", source: "Space", difficulty: 2, category: "science", wordCount: 155 },

  // MORE HARD (difficulty 3)
  { text: "The emergence of large language models has precipitated a paradigmatic shift in natural language processing and artificial intelligence more broadly, challenging established assumptions about machine understanding and generation of human language. These transformer-based architectures, trained on massive corpora of text data encompassing hundreds of billions of parameters, demonstrate remarkable capabilities in tasks ranging from creative writing and code generation to logical reasoning and multimodal understanding. The attention mechanism that underlies these models enables them to capture long-range dependencies and contextual relationships within text, producing outputs that exhibit an unprecedented degree of coherence and sophistication. However, significant challenges remain, including the tendency of these models to generate plausible but factually incorrect information, their substantial computational and environmental costs during training and inference, and fundamental questions about whether statistical pattern matching constitutes genuine understanding or merely a convincing simulacrum thereof. The rapid deployment of these systems across industries has also raised important questions about intellectual property, academic integrity, labor market displacement, and the concentration of technological power among a small number of well-resourced organizations.", source: "AI Language Models", difficulty: 3, category: "technology", wordCount: 170 },
  { text: "The principles of functional programming represent a fundamentally different approach to software construction compared to the imperative and object-oriented paradigms that have dominated mainstream software development for several decades. At its core, functional programming emphasizes the use of pure functions that produce deterministic outputs based solely on their inputs without modifying external state or producing side effects, immutable data structures that cannot be altered after creation, and higher-order functions that accept other functions as arguments or return them as results. This mathematical foundation enables powerful composition patterns where complex behaviors are constructed by combining simpler, well-tested functions in a declarative manner that specifies what should be computed rather than how the computation should proceed step by step. Languages such as Haskell, Clojure, and Elm fully embrace functional programming principles, while mainstream languages like JavaScript, Python, and Java have increasingly incorporated functional features such as lambda expressions, map and reduce operations, and pattern matching constructs that allow developers to leverage functional techniques alongside traditional imperative approaches.", source: "Functional Programming", difficulty: 3, category: "code", wordCount: 174 },
];

const badges = [
  { name: "First Steps", description: "Complete your first typing practice", icon: "🏁", category: "milestone", requirement: { type: "total_practices", value: 1 }, xpReward: 10 },
  { name: "Speed Demon", description: "Reach 80 WPM in any practice", icon: "⚡", category: "speed", requirement: { type: "wpm_best", value: 80 }, xpReward: 50 },
  { name: "Century Club", description: "Reach 100 WPM in any practice", icon: "💯", category: "speed", requirement: { type: "wpm_best", value: 100 }, xpReward: 100 },
  { name: "Perfectionist", description: "Complete a practice with 100% accuracy", icon: "🎯", category: "accuracy", requirement: { type: "accuracy_perfect", value: 100 }, xpReward: 30 },
  { name: "Streak Starter", description: "Maintain a 3-day streak", icon: "🔥", category: "streak", requirement: { type: "streak", value: 3 }, xpReward: 20 },
  { name: "Week Warrior", description: "Maintain a 7-day streak", icon: "⭐", category: "streak", requirement: { type: "streak", value: 7 }, xpReward: 50 },
  { name: "Dedicated Typist", description: "Complete 50 practice sessions", icon: "⌨️", category: "milestone", requirement: { type: "total_practices", value: 50 }, xpReward: 75 },
  { name: "Tournament Debut", description: "Participate in your first tournament", icon: "🏟️", category: "tournament", requirement: { type: "tournaments_played", value: 1 }, xpReward: 25 },
  { name: "Champion", description: "Win a tournament", icon: "🏆", category: "tournament", requirement: { type: "tournaments_won", value: 1 }, xpReward: 200 },
  { name: "Social Butterfly", description: "Refer 3 friends", icon: "🦋", category: "social", requirement: { type: "referrals", value: 3 }, xpReward: 50 },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminHash = await bcrypt.hash('admin123456', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@typmn.com' },
    update: {},
    create: {
      email: 'admin@typmn.com', username: 'admin', passwordHash: adminHash,
      role: 'ADMIN', status: 'ACTIVE', emailVerified: true,
      stats: { create: {} }, streaks: { create: {} },
    },
  });
  console.log('✅ Admin user created (admin@typmn.com / admin123456)');

  // Seed quotes
  for (const q of quotes) {
    await prisma.quote.upsert({
      where: { id: q.text.substring(0, 36) },
      update: {},
      create: q,
    }).catch(() => prisma.quote.create({ data: q }));
  }
  console.log(`✅ ${quotes.length} quotes seeded`);

  // Seed badges
  for (const b of badges) {
    await prisma.badge.upsert({
      where: { name: b.name },
      update: {},
      create: b,
    });
  }
  console.log(`✅ ${badges.length} badges seeded`);

  // Platform settings
  const settings = [
    { key: 'payment_jazzcash', value: { number: '03001234567', name: 'TypmN Official' } },
    { key: 'payment_easypaisa', value: { number: '03001234567', name: 'TypmN Official' } },
    { key: 'payment_bank', value: { bank: 'HBL', account: '1234567890', title: 'TypmN Official' } },
    { key: 'site_name', value: { name: 'TypmN', tagline: 'Train Faster. Compete Smarter. Win Bigger.' } },
  ];
  for (const s of settings) {
    await prisma.platformSettings.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
  }
  console.log('✅ Platform settings seeded');

  // Generate realistic mock data
  console.log('🌱 Generating realistic mock data...');
  const userPassword = await bcrypt.hash('password123', 12);
  const mockUsers = [];
  
  for (let i = 1; i <= 15; i++) {
    const user = await prisma.user.upsert({
      where: { email: `player${i}@test.com` },
      update: {},
      create: {
        email: `player${i}@test.com`,
        username: `Player${i}`,
        passwordHash: userPassword,
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        country: ['🇵🇰', '🇮🇳', '🇺🇸', '🇬🇧', '🇨🇦'][Math.floor(Math.random() * 5)],
        stats: {
          create: {
            totalPractices: 0, bestWpm: 0, avgWpm: 0, level: 1, totalXp: 0,
            bestAccuracy: 0, avgAccuracy: 0, totalTypingTime: 0, totalWordsTyped: 0
          }
        },
        streaks: { create: { currentStreak: Math.floor(Math.random() * 5), longestStreak: Math.floor(Math.random() * 10) } }
      }
    });
    mockUsers.push(user);
  }

  // Generate practice sessions for users
  for (const user of mockUsers) {
    const sessionCount = Math.floor(Math.random() * 10) + 5;
    let totalWpm = 0;
    let totalAcc = 0;
    let bestWpm = 0;
    let bestAcc = 0;
    let totalDuration = 0;

    for (let j = 0; j < sessionCount; j++) {
      const wpm = Math.floor(Math.random() * 60) + 40; // 40 to 100 WPM
      const accuracy = Math.floor(Math.random() * 15) + 85; // 85 to 100%
      const duration = 60;
      
      totalWpm += wpm;
      totalAcc += accuracy;
      bestWpm = Math.max(bestWpm, wpm);
      bestAcc = Math.max(bestAcc, accuracy);
      totalDuration += duration;

      await prisma.practiceSession.create({
        data: {
          userId: user.id,
          mode: 'TIME_60',
          wpm,
          cpm: wpm * 5,
          accuracy,
          errors: Math.floor(Math.random() * 5),
          consistency: 90,
          duration,
          textLength: 300,
          rawText: "Sample typing text for practice.",
          xpEarned: Math.floor(wpm * 0.5 + accuracy * 0.3)
        }
      });
    }

    // Update user stats
    await prisma.userStats.update({
      where: { userId: user.id },
      data: {
        totalPractices: sessionCount,
        bestWpm,
        avgWpm: totalWpm / sessionCount,
        bestAccuracy: bestAcc,
        avgAccuracy: totalAcc / sessionCount,
        totalTypingTime: totalDuration,
        level: Math.floor((sessionCount * 50) / 500) + 1,
        totalXp: sessionCount * 50
      }
    });
  }
  console.log(`✅ Mock practice sessions seeded for ${mockUsers.length} users`);

  // Generate Tournaments
  const t1 = await prisma.tournament.upsert({
    where: { id: 'mock-t1-1234' },
    update: {},
    create: {
      id: 'mock-t1-1234',
      name: 'Speed Blitz Championship',
      type: 'ELIMINATION_BRACKET',
      difficulty: 'medium',
      status: 'REGISTRATION_OPEN',
      entryFee: 200,
      prizePool: 25000,
      maxParticipants: 64,
      currency: 'PKR',
      scheduledAt: new Date(Date.now() + 86400000 * 2),
      endScheduledAt: new Date(Date.now() + 86400000 * 3),
      createdBy: adminUser.id
    }
  });

  const t2 = await prisma.tournament.upsert({
    where: { id: 'mock-t2-5678' },
    update: {},
    create: {
      id: 'mock-t2-5678',
      name: 'Weekend Warrior Cup',
      type: 'TOP_RANKING',
      difficulty: 'easy',
      status: 'REGISTRATION_OPEN',
      entryFee: 150,
      prizePool: 15000,
      maxParticipants: 100,
      currency: 'PKR',
      scheduledAt: new Date(Date.now() + 86400000 * 5),
      endScheduledAt: new Date(Date.now() + 86400000 * 6),
      createdBy: adminUser.id
    }
  });

  console.log('✅ Mock tournaments seeded');

  console.log('\n🎉 Seed complete!\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
