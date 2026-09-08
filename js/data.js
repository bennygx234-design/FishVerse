/* =========================================================================
   MARKET MAYHEM — static game data
   Products, business types, upgrades, events, competitors, quests, achievements
   ========================================================================= */
(function (root) {
  'use strict';

  // ---------- PRODUCTS ------------------------------------------------------
  // cost      : base wholesale cost per unit
  // markup    : "fair" retail price multiplier (fair price = market cost * markup)
  // weight    : relative demand inside a business (1.0 = business base traffic)
  // elasticity: price sensitivity (higher = customers react more to price)
  // volume    : typical market-wide daily units (drives supply pressure)
  const PRODUCTS = {
    // Corner store
    snacks:     { name: 'Snacks',           icon: '🍿', cat: 'food',       cost: 1.0,  markup: 2.0, weight: 1.0, elasticity: 1.8, volume: 4000 },
    soda:       { name: 'Soda',             icon: '🥤', cat: 'drink',      cost: 0.8,  markup: 2.2, weight: 1.0, elasticity: 1.8, volume: 4000 },
    candy:      { name: 'Candy',            icon: '🍬', cat: 'food',       cost: 0.5,  markup: 2.5, weight: 0.9, elasticity: 1.6, volume: 3000 },
    magazines:  { name: 'Magazines',        icon: '📰', cat: 'media',      cost: 2.0,  markup: 1.8, weight: 0.5, elasticity: 2.0, volume: 1500 },
    // Coffee shop
    coffee:     { name: 'Coffee',           icon: '☕', cat: 'drink',      cost: 1.2,  markup: 3.0, weight: 1.0, elasticity: 1.7, volume: 5000, perishable: true },
    pastries:   { name: 'Pastries',         icon: '🥐', cat: 'food',       cost: 1.5,  markup: 2.4, weight: 0.7, elasticity: 1.9, volume: 3000, perishable: true },
    tea:        { name: 'Tea',              icon: '🍵', cat: 'drink',      cost: 0.9,  markup: 3.0, weight: 0.5, elasticity: 1.6, volume: 2500 },
    sandwiches: { name: 'Sandwiches',       icon: '🥪', cat: 'food',       cost: 2.5,  markup: 2.2, weight: 0.6, elasticity: 2.0, volume: 2500, perishable: true },
    // Fashion boutique
    tshirts:    { name: 'T-Shirts',         icon: '👕', cat: 'retail',     cost: 6,    markup: 2.5, weight: 1.0, elasticity: 2.0, volume: 2000 },
    jeans:      { name: 'Jeans',            icon: '👖', cat: 'retail',     cost: 20,   markup: 2.2, weight: 0.7, elasticity: 2.1, volume: 1500 },
    sneakers:   { name: 'Sneakers',         icon: '👟', cat: 'retail',     cost: 45,   markup: 2.0, weight: 0.6, elasticity: 2.2, volume: 1200 },
    jackets:    { name: 'Jackets',          icon: '🧥', cat: 'retail',     cost: 60,   markup: 2.0, weight: 0.4, elasticity: 2.2, volume: 800 },
    // Electronics store
    headphones: { name: 'Headphones',       icon: '🎧', cat: 'tech',       cost: 25,   markup: 1.8, weight: 1.0, elasticity: 2.2, volume: 1500 },
    phones:     { name: 'Smartphones',      icon: '📱', cat: 'tech',       cost: 300,  markup: 1.35, weight: 0.6, elasticity: 2.6, volume: 800 },
    laptops:    { name: 'Laptops',          icon: '💻', cat: 'tech',       cost: 600,  markup: 1.3, weight: 0.4, elasticity: 2.6, volume: 500 },
    gadgets:    { name: 'Gadgets',          icon: '🎮', cat: 'tech',       cost: 40,   markup: 1.9, weight: 0.9, elasticity: 2.0, volume: 1500 },
    // Restaurant
    meals:      { name: 'Meals',            icon: '🍝', cat: 'food',       cost: 8,    markup: 3.0, weight: 1.0, elasticity: 1.8, volume: 6000, perishable: true },
    wine:       { name: 'Wine',             icon: '🍷', cat: 'drink',      cost: 12,   markup: 3.0, weight: 0.5, elasticity: 2.0, volume: 2000 },
    desserts:   { name: 'Desserts',         icon: '🍰', cat: 'food',       cost: 3,    markup: 3.5, weight: 0.7, elasticity: 1.6, volume: 3000, perishable: true },
    cocktails:  { name: 'Cocktails',        icon: '🍸', cat: 'drink',      cost: 4,    markup: 4.0, weight: 0.6, elasticity: 1.8, volume: 3000 },
    // Supermarket
    groceries:  { name: 'Groceries',        icon: '🥫', cat: 'food',       cost: 3,    markup: 1.6, weight: 1.0, elasticity: 1.6, volume: 40000 },
    produce:    { name: 'Produce',          icon: '🥬', cat: 'food',       cost: 2,    markup: 1.8, weight: 0.9, elasticity: 1.7, volume: 30000, perishable: true },
    meat:       { name: 'Meat',             icon: '🥩', cat: 'food',       cost: 8,    markup: 1.5, weight: 0.5, elasticity: 1.9, volume: 15000, perishable: true },
    household:  { name: 'Household Goods',  icon: '🧴', cat: 'retail',     cost: 4,    markup: 1.7, weight: 0.7, elasticity: 1.7, volume: 20000 },
    // Car dealership
    sedans:     { name: 'Sedans',           icon: '🚗', cat: 'auto',       cost: 18000,  markup: 1.25, weight: 1.0, elasticity: 3.0, volume: 40 },
    suvs:       { name: 'SUVs',             icon: '🚙', cat: 'auto',       cost: 28000,  markup: 1.25, weight: 0.8, elasticity: 3.0, volume: 30 },
    sports:     { name: 'Sports Cars',      icon: '🏎️', cat: 'auto',       cost: 60000,  markup: 1.3,  weight: 0.3, elasticity: 3.2, volume: 10 },
    evs:        { name: 'Electric Cars',    icon: '⚡', cat: 'auto',       cost: 35000,  markup: 1.3,  weight: 0.6, elasticity: 3.0, volume: 25 },
    // Tech startup
    licenses:   { name: 'Software Licenses',   icon: '💿', cat: 'tech',    cost: 20,    markup: 5.0, weight: 1.0,  elasticity: 1.8, volume: 20000 },
    cloud:      { name: 'Cloud Subscriptions', icon: '☁️', cat: 'tech',    cost: 50,    markup: 4.0, weight: 0.6,  elasticity: 1.8, volume: 12000 },
    ai:         { name: 'AI Services',         icon: '🤖', cat: 'tech',    cost: 200,   markup: 3.5, weight: 0.25, elasticity: 2.0, volume: 4000 },
    enterprise: { name: 'Enterprise Contracts',icon: '🏢', cat: 'tech',    cost: 5000,  markup: 2.5, weight: 0.01, elasticity: 2.2, volume: 150 },
    // Factory
    steel:      { name: 'Steel (tons)',     icon: '🔩', cat: 'industrial', cost: 500,   markup: 1.5, weight: 1.0,  elasticity: 2.0, volume: 20000 },
    components: { name: 'Components',       icon: '⚙️', cat: 'industrial', cost: 150,   markup: 1.8, weight: 2.0,  elasticity: 1.8, volume: 40000 },
    machinery:  { name: 'Machinery',        icon: '🏗️', cat: 'industrial', cost: 20000, markup: 1.6, weight: 0.02, elasticity: 2.2, volume: 300 },
    parts:      { name: 'Auto Parts',       icon: '🔧', cat: 'industrial', cost: 800,   markup: 1.7, weight: 0.8,  elasticity: 1.9, volume: 15000 },
    // Pharma lab
    vitamins:   { name: 'Vitamins',         icon: '💊', cat: 'pharma',     cost: 5,      markup: 3.0, weight: 1.0,    elasticity: 1.7, volume: 100000 },
    medicines:  { name: 'Medicines',        icon: '🩺', cat: 'pharma',     cost: 40,     markup: 3.0, weight: 0.5,    elasticity: 1.6, volume: 50000 },
    vaccines:   { name: 'Vaccines',         icon: '💉', cat: 'pharma',     cost: 150,    markup: 2.5, weight: 0.3,    elasticity: 1.5, volume: 30000 },
    patents:    { name: 'Biotech Patents',  icon: '🧬', cat: 'pharma',     cost: 500000, markup: 1.8, weight: 0.0005, elasticity: 2.5, volume: 50 },
    // Aerospace
    drones:     { name: 'Drones',           icon: '🛸', cat: 'aero',       cost: 2000,     markup: 2.0, weight: 1.0,   elasticity: 2.0, volume: 5000 },
    tickets:    { name: 'Space Tourism',    icon: '🎫', cat: 'aero',       cost: 250000,   markup: 2.5, weight: 0.02,  elasticity: 2.4, volume: 100 },
    satellites: { name: 'Satellites',       icon: '🛰️', cat: 'aero',       cost: 3000000,  markup: 1.6, weight: 0.005, elasticity: 2.6, volume: 20 },
    launches:   { name: 'Rocket Launches',  icon: '🚀', cat: 'aero',       cost: 20000000, markup: 1.5, weight: 0.001, elasticity: 2.8, volume: 5 },
  };

  const CATEGORIES = {
    food: 'Food', drink: 'Drinks', media: 'Media', retail: 'Retail', tech: 'Tech',
    auto: 'Automotive', industrial: 'Industrial', pharma: 'Pharma', aero: 'Aerospace',
  };

  // ---------- BUSINESS TYPES --------------------------------------------------
  // traffic   : daily demand units for a weight-1.0 product at the fair price
  // staffCap  : units one employee can serve per day
  // wage      : base daily wage per employee
  const BUSINESS_TYPES = {
    corner:      { name: 'Corner Store',       icon: '🏪', tier: 1, cost: 3000,      unlock: 0,          traffic: 66,    rent: 25,     wage: 40,  staffCap: 120, staff: 1,   products: ['snacks', 'soda', 'candy', 'magazines'],
                   blurb: 'Small, cheap and reliable. Every empire starts somewhere.' },
    coffee:      { name: 'Coffee Shop',        icon: '☕', tier: 1, cost: 8000,      unlock: 2500,       traffic: 64,    rent: 60,     wage: 45,  staffCap: 90,  staff: 2,   products: ['coffee', 'pastries', 'tea', 'sandwiches'],
                   blurb: 'Huge margins on caffeine. Perishable stock, so keep it fresh.' },
    fashion:     { name: 'Fashion Boutique',   icon: '👗', tier: 2, cost: 40000,     unlock: 20000,      traffic: 19,    rent: 200,    wage: 60,  staffCap: 15,  staff: 2,   products: ['tshirts', 'jeans', 'sneakers', 'jackets'],
                   blurb: 'Trendy customers, premium prices, fickle demand.' },
    electronics: { name: 'Electronics Store',  icon: '📱', tier: 2, cost: 50000,     unlock: 25000,      traffic: 9.5,    rent: 250,    wage: 70,  staffCap: 8,   staff: 2,   products: ['headphones', 'phones', 'laptops', 'gadgets'],
                   blurb: 'Big-ticket gadgets. Price-sensitive shoppers.' },
    restaurant:  { name: 'Restaurant',         icon: '🍽️', tier: 3, cost: 180000,    unlock: 100000,     traffic: 138,   rent: 900,    wage: 55,  staffCap: 45,  staff: 5,   products: ['meals', 'wine', 'desserts', 'cocktails'],
                   blurb: 'Great margins and steady traffic. Needs a lot of staff.' },
    supermarket: { name: 'Supermarket',        icon: '🛒', tier: 3, cost: 250000,    unlock: 150000,     traffic: 1100,  rent: 1500,   wage: 50,  staffCap: 250, staff: 8,   products: ['groceries', 'produce', 'meat', 'household'],
                   blurb: 'Massive volume, thin margins. A cash machine when run well.' },
    dealership:  { name: 'Car Dealership',     icon: '🚗', tier: 4, cost: 1500000,   unlock: 900000,     traffic: 1.6,   rent: 6000,   wage: 150, staffCap: 1,   staff: 3,   products: ['sedans', 'suvs', 'sports', 'evs'],
                   blurb: 'Few sales, enormous tickets. Inventory is expensive — use credit wisely.' },
    tech:        { name: 'Tech Startup',       icon: '💻', tier: 5, cost: 6000000,   unlock: 3500000,    traffic: 370,   rent: 15000,  wage: 300, staffCap: 60,  staff: 10,  products: ['licenses', 'cloud', 'ai', 'enterprise'],
                   blurb: 'Software scales. Enterprise contracts are rare but lucrative.' },
    factory:     { name: 'Factory',            icon: '🏭', tier: 5, cost: 25000000,  unlock: 15000000,   traffic: 440,   rent: 60000,  wage: 120, staffCap: 60,  staff: 30,  products: ['steel', 'components', 'machinery', 'parts'],
                   blurb: 'Heavy industry. Feeds the whole economy.' },
    pharma:      { name: 'Pharma Lab',         icon: '🧬', tier: 6, cost: 80000000,  unlock: 45000000,   traffic: 4600, rent: 150000, wage: 400, staffCap: 200, staff: 50,  products: ['vitamins', 'medicines', 'vaccines', 'patents'],
                   blurb: 'Research pays. Patents can be worth a fortune.' },
    aerospace:   { name: 'Aerospace Corp',     icon: '🚀', tier: 7, cost: 300000000, unlock: 180000000,  traffic: 180,   rent: 800000, wage: 800, staffCap: 2.5, staff: 100, products: ['drones', 'tickets', 'satellites', 'launches'],
                   blurb: 'To the moon. Literally. Sell a rocket launch and retire.' },
  };
  const TYPE_ORDER = ['corner', 'coffee', 'fashion', 'electronics', 'restaurant', 'supermarket', 'dealership', 'tech', 'factory', 'pharma', 'aerospace'];

  // ---------- BUSINESS UPGRADES ---------------------------------------------
  // cost = businessBaseCost * costFactor * 1.6^level
  const UPGRADES = {
    storage:    { name: 'Storage Expansion', icon: '📦', max: 5, costFactor: 0.15, desc: '+5 days of stock capacity per level.' },
    renovation: { name: 'Renovation',        icon: '🛠️', max: 3, costFactor: 0.25, desc: '+8% foot traffic per level and an instant +10 reputation.' },
    automation: { name: 'Automation',        icon: '🤖', max: 3, costFactor: 0.30, desc: 'Each employee serves 30% more customers per level.' },
    loyalty:    { name: 'Loyalty Program',   icon: '💳', max: 1, costFactor: 0.35, desc: '+10% demand from repeat customers.' },
    premium:    { name: 'Premium Branding',  icon: '✨', max: 2, costFactor: 0.40, desc: 'Customers tolerate higher prices (-20% price sensitivity per level).' },
  };

  // ---------- HQ (COMPANY-WIDE) UPGRADES --------------------------------------
  const HQ_UPGRADES = {
    logistics: { name: 'Logistics Network', icon: '🚚', max: 5, base: 2500,   mult: 4, desc: '-5% wholesale purchase cost per level.' },
    marketing: { name: 'Marketing Agency',  icon: '📣', max: 5, base: 3000,   mult: 4, desc: '+6% traffic at every business per level.' },
    hr:        { name: 'HR Department',     icon: '👥', max: 4, base: 4000,   mult: 4, desc: '-6% wages and +3% productivity per level.' },
    analytics: { name: 'Analytics Suite',   icon: '📊', max: 1, base: 6000,   mult: 1, desc: 'Unlocks demand forecasts, price suggestions and Smart Pricing.' },
    legal:     { name: 'Legal Team',        icon: '⚖️', max: 1, base: 25000,  mult: 1, desc: 'Negative events hurt 35% less.' },
    ir:        { name: 'Investor Relations',icon: '🏦', max: 3, base: 50000,  mult: 5, desc: '+10% company valuation multiple per level.' },
    franchise: { name: 'Franchise Program', icon: '🏬', max: 3, base: 75000,  mult: 5, desc: '-8% cost of new businesses per level.' },
  };

  // ---------- AI COMPETITORS ----------------------------------------------------
  const COMPETITORS = [
    { id: 'cornerking', name: 'Corner King',    icon: '🛒', value: 40000,     growth: 0.0040, vol: 0.030, types: ['corner'],
      taunts: ['Corner King puts up a "Best Snacks in Town" sign.', 'Corner King: "Nice try, rookie."'] },
    { id: 'java',     name: 'Java Junction',    icon: '☕', value: 150000,    growth: 0.0045, vol: 0.030, types: ['coffee'],
      taunts: ['Java Junction launches a pumpkin-spice everything menu.', 'Java Junction baristas mock your latte art.'] },
    { id: 'freshco',  name: 'FreshCo Markets',  icon: '🥦', value: 600000,    growth: 0.0045, vol: 0.025, types: ['corner', 'supermarket', 'coffee'],
      taunts: ['FreshCo opens three new stores across town.', 'FreshCo: "Cute little shop you have there."'] },
    { id: 'glamour',  name: 'Glamour Inc.',     icon: '👠', value: 900000,    growth: 0.0045, vol: 0.030, types: ['fashion', 'restaurant'],
      taunts: ['Glamour Inc. launches a celebrity clothing line.', 'Glamour Inc. mocks your "budget" branding.'] },
    { id: 'bytes',    name: 'Bytes & Bits',     icon: '💾', value: 2000000,   growth: 0.0050, vol: 0.030, types: ['electronics', 'tech'],
      taunts: ['Bytes & Bits ships a new flagship phone.', 'Bytes & Bits poaches two of your engineers.'] },
    { id: 'velocity', name: 'Velocity Motors',  icon: '🏎️', value: 25000000,  growth: 0.0035, vol: 0.025, types: ['dealership', 'factory'],
      taunts: ['Velocity Motors unveils a hypercar.', 'Velocity Motors calls your dealership "a parking lot".'] },
    { id: 'helix',    name: 'Helix Pharma',     icon: '💊', value: 90000000,  growth: 0.0030, vol: 0.020, types: ['pharma'],
      taunts: ['Helix Pharma patents a miracle cure.', 'Helix Pharma is "not worried" about you.'] },
    { id: 'omnicorp', name: 'Omnicorp',         icon: '🏢', value: 300000000, growth: 0.0010, vol: 0.015, types: ['*'],
      taunts: ['Omnicorp acquires another city block.', 'Omnicorp CEO: "Who?"'] },
  ];

  // ---------- MARKET EVENTS -----------------------------------------------------
  // effects apply while the event is active. Multipliers default to 1.
  // demand: { all, cat:{}, biz:{}, product:'{product}' } cost: { all, cat:{} }
  const EVENTS = [
    { id: 'heatwave',     kind: 'good',    icon: '🌡️', title: 'Heatwave',              w: 8, dur: 7,  desc: 'Temperatures soar. Everyone wants a cold drink.',
      fx: { demand: { cat: { drink: 1.8 } } } },
    { id: 'cold_snap',    kind: 'neutral', icon: '❄️', title: 'Cold Snap',             w: 6, dur: 6,  desc: 'Comfort food is in, cold drinks are out.',
      fx: { demand: { cat: { food: 1.3, drink: 0.8, retail: 1.2 } } } },
    { id: 'boom',         kind: 'good',    icon: '📈', title: 'Economic Boom',         w: 6, dur: 15, desc: 'Consumers are spending freely. Demand up across the board.',
      fx: { demand: { all: 1.25 }, sentiment: 0.1 } },
    { id: 'recession',    kind: 'bad',     icon: '📉', title: 'Recession',             w: 5, dur: 20, minDay: 30, desc: 'Wallets close. Demand falls everywhere.',
      fx: { demand: { all: 0.75 }, sentiment: -0.15 } },
    { id: 'supply_crisis',kind: 'bad',     icon: '🚢', title: 'Supply Chain Crisis',   w: 6, dur: 12, desc: 'Ships are stuck. Wholesale costs jump.',
      fx: { cost: { all: 1.4 } } },
    { id: 'viral',        kind: 'good',    icon: '🔥', title: 'Viral Trend',           w: 9, dur: 6,  desc: '{product} is all over social media. Demand explodes!', pickProduct: true,
      fx: { demand: { product: 2.5 } } },
    { id: 'holiday',      kind: 'good',    icon: '🎁', title: 'Holiday Season',        w: 6, dur: 10, minDay: 20, desc: 'Gift shopping frenzy! Retail and tech fly off the shelves.',
      fx: { demand: { cat: { retail: 1.6, tech: 1.5, food: 1.2 } } } },
    { id: 'tax_audit',    kind: 'bad',     icon: '🧾', title: 'Tax Audit',             w: 4, dur: 0,  minDay: 60, desc: 'The tax office found "irregularities". You pay 8% of your cash.',
      instant: { cashPct: -0.08 } },
    { id: 'rate_hike',    kind: 'bad',     icon: '🏦', title: 'Interest Rate Hike',    w: 5, dur: 30, minDay: 15, desc: 'The central bank raises rates. Borrowing gets pricey.',
      fx: { rate: 1.5, sentiment: -0.05 } },
    { id: 'rate_cut',     kind: 'good',    icon: '🏦', title: 'Interest Rate Cut',     w: 5, dur: 30, minDay: 15, desc: 'Cheap money! Loan interest drops.',
      fx: { rate: 0.6, sentiment: 0.05 } },
    { id: 'health_scare', kind: 'bad',     icon: '🤒', title: 'Health Scare',          w: 5, dur: 8,  desc: 'People avoid eating out. Pharmacies are busy.',
      fx: { demand: { biz: { restaurant: 0.6, coffee: 0.7 }, cat: { pharma: 1.4 } } } },
    { id: 'tech_boom',    kind: 'good',    icon: '🤖', title: 'Tech Breakthrough',     w: 6, dur: 10, desc: 'A new gadget craze sweeps the nation.',
      fx: { demand: { cat: { tech: 1.7 } } } },
    { id: 'strike',       kind: 'bad',     icon: '✊', title: 'Labor Strike',          w: 5, dur: 7,  minDay: 40, desc: 'Workers walk out. Wages up, productivity down.',
      fx: { wage: 1.5, productivity: 0.8 } },
    { id: 'price_war',    kind: 'bad',     icon: '⚔️', title: 'Price War',             w: 6, dur: 10, minDay: 10, desc: 'Rivals slash prices to steal your customers.',
      fx: { competition: 1.6 } },
    { id: 'endorsement',  kind: 'good',    icon: '⭐', title: 'Celebrity Endorsement', w: 5, dur: 8,  minDay: 10, desc: 'A celebrity was spotted at {biz}. Fans flood in!', pickBiz: true,
      instant: { repDelta: 20 }, fx: { traffic: 1.3 } },
    { id: 'fuel_spike',   kind: 'bad',     icon: '⛽', title: 'Fuel Price Spike',      w: 5, dur: 10, desc: 'Fuel costs surge. Car demand drops and deliveries cost more.',
      fx: { demand: { cat: { auto: 0.7 } }, cost: { all: 1.12 } } },
    { id: 'rally',        kind: 'good',    icon: '🚀', title: 'Stock Market Rally',    w: 5, dur: 12, minDay: 20, desc: 'Investors are euphoric. Valuations climb.',
      fx: { sentiment: 0.2 } },
    { id: 'crash',        kind: 'bad',     icon: '💥', title: 'Market Crash',          w: 4, dur: 15, minDay: 90, desc: 'Panic on the trading floor! Valuations tumble.',
      fx: { sentiment: -0.3 }, instant: { competitorPct: -0.15 } },
    { id: 'grant',        kind: 'good',    icon: '🏛️', title: 'Government Grant',      w: 4, dur: 0,  desc: 'Your business wins a small-business grant.',
      instant: { cashPctOfValue: 0.05, cashMin: 500 } },
    { id: 'robbery',      kind: 'bad',     icon: '🥷', title: 'Robbery',               w: 4, dur: 0,  minDay: 25, desc: 'Thieves hit {biz} overnight and took 25% of its stock.', pickBiz: true,
      instant: { inventoryLossPct: 0.25 } },
    { id: 'flu_season',   kind: 'neutral', icon: '🤧', title: 'Flu Season',            w: 4, dur: 10, desc: 'Everyone is sniffling. Pharma booms, restaurants suffer.',
      fx: { demand: { cat: { pharma: 1.8 }, biz: { restaurant: 0.85 } } } },
    { id: 'inflation',    kind: 'bad',     icon: '💸', title: 'Inflation Surge',       w: 4, dur: 20, minDay: 100, desc: 'Prices rise everywhere. Costs and wages climb.',
      fx: { cost: { all: 1.2 }, wage: 1.15 } },
    { id: 'harvest',      kind: 'good',    icon: '🌾', title: 'Bumper Harvest',        w: 5, dur: 10, desc: 'Record crops make food wholesale dirt cheap.',
      fx: { cost: { cat: { food: 0.7 } } } },
    { id: 'chip_shortage',kind: 'bad',     icon: '🔌', title: 'Chip Shortage',         w: 4, dur: 12, minDay: 50, desc: 'Semiconductors are scarce. Tech costs rise.',
      fx: { cost: { cat: { tech: 1.5 } }, demand: { cat: { tech: 0.9 } } } },
    { id: 'space_race',   kind: 'good',    icon: '🌌', title: 'Space Race',            w: 3, dur: 15, minDay: 300, desc: 'Nations race to orbit. Aerospace demand skyrockets.',
      fx: { demand: { cat: { aero: 1.8 } } } },
    { id: 'construction', kind: 'good',    icon: '🏗️', title: 'Construction Boom',     w: 4, dur: 12, minDay: 150, desc: 'Cranes everywhere. Industrial goods in high demand.',
      fx: { demand: { cat: { industrial: 1.6 } } } },
    { id: 'lottery',      kind: 'good',    icon: '🍀', title: 'Lucky Break',           w: 2, dur: 0,  minDay: 30, desc: 'A forgotten investment pays off unexpectedly.',
      instant: { cashPctOfValue: 0.03, cashMin: 1000 } },

    // ---- Decision events -------------------------------------------------------
    { id: 'bulk_deal', kind: 'choice', icon: '📦', title: 'Bulk Supplier Offer', w: 6, minDay: 8, pickCat: true,
      desc: 'A supplier offers 30% off all {cat} wholesale prices for 20 days if you pay a {fee} fee up front.',
      feePctOfValue: 0.03, feeMin: 300,
      choices: [
        { label: 'Pay the fee', instant: { payFee: true }, fx: { cost: { catPick: 0.7 } }, dur: 20, msg: 'Deal! {cat} costs are 30% lower for 20 days.' },
        { label: 'No thanks', msg: 'You passed on the deal.' },
      ] },
    { id: 'recall', kind: 'choice', icon: '⚠️', title: 'Product Recall', w: 4, minDay: 30, pickBizProduct: true,
      desc: 'A faulty batch of {product} was found at {biz}. Recall it for {fee}, or ignore the problem and hope nobody notices.',
      feePctOfCash: 0.05, feeMin: 200,
      choices: [
        { label: 'Recall (pay {fee})', instant: { payFee: true, inventoryLossPctProduct: 0.5 }, msg: 'Recall complete. Customers appreciate your honesty.' },
        { label: 'Ignore it', instant: { repDelta: -25, inventoryLossPctProduct: 0.1 }, msg: 'Word got out. Reputation at {biz} took a hit.' },
      ] },
    { id: 'buyout', kind: 'choice', icon: '💼', title: 'Acquisition Offer', w: 3, minDay: 60, pickBiz: true, needsMultiBiz: true,
      desc: 'An investor group offers {fee} in cash for {biz}. That is 40% above what you paid.',
      feeFromBizPaid: 1.4,
      choices: [
        { label: 'Sell it', instant: { sellBiz: true }, msg: 'Sold! {biz} is now under new management.' },
        { label: 'Keep it', msg: 'You kept {biz}. Loyalty over cash.' },
      ] },
    { id: 'sponsorship', kind: 'choice', icon: '🎪', title: 'Sponsorship Deal', w: 5, minDay: 15,
      desc: 'Sponsor the city festival for {fee}? Your brand would be everywhere for two weeks.',
      feePctOfValue: 0.02, feeMin: 250,
      choices: [
        { label: 'Sponsor it', instant: { payFee: true }, fx: { traffic: 1.3 }, dur: 15, msg: 'Banners are up! Traffic +30% for 15 days.' },
        { label: 'Pass', msg: 'You skipped the festival.' },
      ] },
    { id: 'union', kind: 'choice', icon: '📢', title: 'Union Demands', w: 4, minDay: 45,
      desc: 'Your employees demand a 20% raise for the next month. Refusing could hurt morale.',
      choices: [
        { label: 'Give the raise', fx: { wage: 1.2 }, dur: 30, msg: 'Raise granted. Your team is happy.' },
        { label: 'Refuse', fx: { productivity: 0.75 }, dur: 10, instant: { repDeltaAll: -5 }, msg: 'Morale slumps. Productivity down for 10 days.' },
      ] },
    { id: 'insider', kind: 'choice', icon: '🕵️', title: 'Insider Tip', w: 3, minDay: 40, pickProduct: true,
      desc: 'A "friend" says {product} demand is about to spike and offers to run a marketing blitz for {fee}.',
      feePctOfValue: 0.025, feeMin: 400,
      choices: [
        { label: 'Fund the blitz', instant: { payFee: true }, fx: { demand: { product: 2.2 } }, dur: 10, msg: '{product} demand doubles for 10 days!' },
        { label: 'Ignore', msg: 'You ignored the tip.' },
      ] },
  ];

  // ---------- QUESTS (rotating objectives) ---------------------------------------
  // Each quest template generates a concrete goal scaled to the player's stage.
  const QUEST_TEMPLATES = [
    { id: 'earn_cash',   text: 'Earn {target} in profit',            metric: 'profitSince',   scale: 'profit', mult: 12, reward: 0.35 },
    { id: 'sell_units',  text: 'Sell {target} units of {product}',   metric: 'unitsSince',    scale: 'units',  mult: 10, reward: 0.30 },
    { id: 'rep',         text: 'Reach {target} reputation at {biz}', metric: 'repAt',         scale: 'rep',    reward: 0.25 },
    { id: 'staff',       text: 'Employ {target} people in total',    metric: 'totalStaff',    scale: 'staff',  reward: 0.25 },
    { id: 'upgrades',    text: 'Buy {target} upgrades',              metric: 'upgradesSince', scale: 'count',  reward: 0.30 },
    { id: 'value',       text: 'Reach {target} company value',       metric: 'valuation',     scale: 'value',  mult: 1.6, reward: 0.20 },
    { id: 'businesses',  text: 'Own {target} businesses',            metric: 'bizCount',      scale: 'biz',    reward: 0.40 },
    { id: 'cash',        text: 'Hold {target} in cash',              metric: 'cash',          scale: 'cash',   mult: 2.5, reward: 0.20 },
    { id: 'streak',      text: 'Stay profitable {target} days in a row', metric: 'streak',    scale: 'streak', reward: 0.30 },
    { id: 'debtfree',    text: 'Pay off all your loans',             metric: 'debtFree',      scale: 'none',   reward: 0.25 },
  ];

  // ---------- ACHIEVEMENTS ----------------------------------------------------------
  const ACHIEVEMENTS = [
    { id: 'first_sale',   icon: '🛍️', name: 'Open for Business',  desc: 'Make your first sale.',                      check: s => s.stats.unitsSold > 0 },
    { id: 'first_1k',     icon: '💵', name: 'Pocket Money',        desc: 'Earn $1,000 in total profit.',              check: s => s.stats.totalProfit >= 1000, bonus: 200 },
    { id: 'first_loan',   icon: '🏦', name: 'Leveraged',           desc: 'Take your first loan.',                     check: s => s.stats.loansTaken > 0 },
    { id: 'hire_5',       icon: '👥', name: 'Boss',                desc: 'Employ 5 people.',                          check: s => s.stats.maxStaff >= 5 },
    { id: 'second_biz',   icon: '🏬', name: 'Chain Reaction',      desc: 'Own 2 businesses.',                         check: s => s.businesses.length >= 2, bonus: 500 },
    { id: 'rep_90',       icon: '⭐', name: 'Beloved',             desc: 'Reach 90 reputation at a business.',        check: s => s.businesses.some(b => b.rep >= 90), bonus: 1000 },
    { id: 'value_10k',    icon: '🌱', name: 'Sprouting',           desc: 'Reach $10K company value.',                 check: s => s.valuation >= 1e4, bonus: 300 },
    { id: 'value_100k',   icon: '📈', name: 'Six Figures',         desc: 'Reach $100K company value.',                check: s => s.valuation >= 1e5, bonus: 2500 },
    { id: 'value_1m',     icon: '💎', name: 'Millionaire',         desc: 'Reach $1M company value.',                  check: s => s.valuation >= 1e6, bonus: 25000 },
    { id: 'value_10m',    icon: '🏆', name: 'Tycoon',              desc: 'Reach $10M company value.',                 check: s => s.valuation >= 1e7, bonus: 250000 },
    { id: 'value_100m',   icon: '👑', name: 'Mogul',               desc: 'Reach $100M company value.',                check: s => s.valuation >= 1e8, bonus: 2500000 },
    { id: 'value_1b',     icon: '🌍', name: 'Market Mayhem',       desc: 'Reach $1B company value. You win!',         check: s => s.valuation >= 1e9 },
    { id: 'five_biz',     icon: '🏙️', name: 'Empire Builder',      desc: 'Own 5 businesses.',                         check: s => s.businesses.length >= 5, bonus: 20000 },
    { id: 'ten_biz',      icon: '🌆', name: 'Conglomerate',        desc: 'Own 10 businesses.',                        check: s => s.businesses.length >= 10, bonus: 500000 },
    { id: 'survive_rec',  icon: '🛡️', name: 'Storm Rider',         desc: 'Survive a recession with positive cash.',   check: s => s.stats.recessionsSurvived > 0, bonus: 5000 },
    { id: 'beat_rival',   icon: '🥊', name: 'Giant Slayer',        desc: 'Overtake a rival in company value.',        check: s => s.stats.rivalsBeaten > 0, bonus: 2000 },
    { id: 'top_rank',     icon: '🥇', name: 'Number One',          desc: 'Become the most valuable company.',         check: s => s.stats.reachedRank1, bonus: 1000000 },
    { id: 'acquire',      icon: '🤝', name: 'Hostile Takeover',    desc: 'Acquire a rival company.',                  check: s => s.stats.acquisitions > 0 },
    { id: 'debt_free',    icon: '🕊️', name: 'Debt Free',           desc: 'Repay $50K of loans in total.',            check: s => s.stats.loansRepaid >= 50000, bonus: 5000 },
    { id: 'big_sale',     icon: '🚀', name: 'Moonshot',            desc: 'Sell a single item worth $1M or more.',     check: s => s.stats.biggestSale >= 1e6, bonus: 1000000 },
    { id: 'trader',       icon: '📊', name: 'Wolf of Main Street', desc: 'Make $100K profit trading rival stocks.',   check: s => s.stats.tradingProfit >= 1e5, bonus: 50000 },
    { id: 'streak_30',    icon: '🔥', name: 'On a Roll',           desc: 'Stay profitable 30 days in a row.',         check: s => s.stats.bestStreak >= 30, bonus: 3000 },
    { id: 'quests_10',    icon: '📜', name: 'Overachiever',        desc: 'Complete 10 quests.',                       check: s => s.stats.questsDone >= 10, bonus: 10000 },
    { id: 'year_one',     icon: '📅', name: 'Anniversary',         desc: 'Survive one full year (360 days).',         check: s => s.day >= 360, bonus: 10000 },
    { id: 'all_types',    icon: '🧩', name: 'Diversified',         desc: 'Own every type of business.',               check: s => new Set(s.businesses.map(b => b.type)).size >= TYPE_ORDER.length, bonus: 5000000 },
  ];

  const TIPS = [
    'Prices track wholesale costs. When costs rise, raise prices or your margin evaporates.',
    'Understaffed stores lose sales AND reputation. Watch the service bar.',
    'Auto-restock keeps shelves full so you can focus on expansion.',
    'Loans are cheap when your ROI is high. Debt is a tool, not a sin.',
    'Reputation multiplies traffic. Keep stock full and staff happy.',
    'Rival stocks crash during market panics. Buy the dip.',
    'Each additional store of the same type shares the same customers.',
    'Bulk buying pushes wholesale prices up. Spread your purchases out.',
    'Investor Relations upgrades boost your valuation multiple directly.',
    'Space is pointless unless you can pay rent. Check the P&L before expanding.',
    'Perishable goods spoil. Do not overstock coffee shops and restaurants.',
    'Press SPACE to pause and 1-4 to change speed.',
  ];

  const DIFFICULTY = {
    easy:   { name: 'Easy',   badEvents: 0.7, rivalGrowth: 0.8,  rate: 0.8, demand: 1.1, desc: 'Gentler events, slower rivals, cheaper loans.' },
    normal: { name: 'Normal', badEvents: 1.0, rivalGrowth: 1.0,  rate: 1.0, demand: 1.0, desc: 'The intended experience.' },
    hard:   { name: 'Hard',   badEvents: 1.3, rivalGrowth: 1.25, rate: 1.3, demand: 0.9, desc: 'Brutal events, aggressive rivals, expensive credit.' },
  };

  const DATA = { PRODUCTS, CATEGORIES, BUSINESS_TYPES, TYPE_ORDER, UPGRADES, HQ_UPGRADES, COMPETITORS, EVENTS, QUEST_TEMPLATES, ACHIEVEMENTS, TIPS, DIFFICULTY,
    WIN_VALUE: 1e9, START_CASH: 1000, SHARES: 1000000 };

  root.MM_DATA = DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
