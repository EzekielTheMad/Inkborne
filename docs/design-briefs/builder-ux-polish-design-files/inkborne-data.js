// Sample data for the prototypes — SRD-adjacent, paraphrased.
// Not production copy; just realistic enough to pressure-test density.

window.INKBORNE_DATA = (() => {
  const fighterLevels = [
    { level: 1, features: [
      { slug: "fighting-style", name: "Fighting Style", kind: "choice",
        description: "Adopt a particular style of fighting as your specialty.",
        options: [
          { slug: "defense", name: "Defense", desc: "+1 AC while you are wearing armor." },
          { slug: "dueling", name: "Dueling", desc: "+2 damage with a one-handed weapon and no other weapon." },
          { slug: "great-weapon", name: "Great Weapon Fighting", desc: "Reroll 1s and 2s on damage with two-handed weapons." },
          { slug: "archery", name: "Archery", desc: "+2 to attack rolls you make with ranged weapons." },
          { slug: "protection", name: "Protection", desc: "Impose disadvantage on an attack against a creature within 5 ft." },
          { slug: "two-weapon", name: "Two-Weapon Fighting", desc: "Add your ability modifier to the damage of the off-hand attack." },
        ],
        selected: "defense",
      },
      { slug: "second-wind", name: "Second Wind", kind: "passive",
        description: "On your turn, use a bonus action to regain 1d10 + fighter level hit points. Once per short rest." },
    ]},
    { level: 2, features: [
      { slug: "action-surge", name: "Action Surge", kind: "passive",
        description: "Once per short rest, take one additional action on top of your regular action. Starting at 17th level, you can use it twice before a rest." },
    ]},
    { level: 3, features: [
      { slug: "martial-archetype", name: "Martial Archetype", kind: "subclass-unlock",
        description: "Choose an archetype that you strive to emulate in your combat styles and techniques." },
      { slug: "combat-superiority", name: "Combat Superiority", kind: "subclass", subclass: "battle-master",
        description: "You learn three maneuvers fueled by superiority dice. You have four d8 superiority dice." },
      { slug: "student-of-war", name: "Student of War", kind: "subclass", subclass: "battle-master",
        description: "Gain proficiency with one type of artisan's tools of your choice.",
        choiceLabel: "Choose an artisan's tool",
      },
    ]},
    { level: 4, features: [
      { slug: "asi-4", name: "Ability Score Improvement", kind: "asi",
        description: "Increase one ability score by 2, or two by 1. You can instead take a feat." },
    ]},
    { level: 5, features: [
      { slug: "extra-attack", name: "Extra Attack", kind: "passive",
        description: "You can attack twice, instead of once, whenever you take the Attack action." },
    ]},
    { level: 6, features: [
      { slug: "asi-6", name: "Ability Score Improvement", kind: "asi",
        description: "Increase one ability score by 2, or two by 1. You can instead take a feat." },
    ]},
    { level: 7, features: [
      { slug: "know-your-enemy", name: "Know Your Enemy", kind: "subclass", subclass: "battle-master",
        description: "If you spend at least 1 minute observing or interacting with another creature, you learn certain information about its capabilities." },
    ]},
    { level: 8, features: [
      { slug: "asi-8", name: "Ability Score Improvement", kind: "asi",
        description: "Increase one ability score by 2, or two by 1. You can instead take a feat." },
    ]},
    { level: 9, features: [
      { slug: "indomitable", name: "Indomitable", kind: "passive",
        description: "You can reroll a saving throw that you fail. You must use the new roll. Once per long rest." },
    ]},
    { level: 10, features: [
      { slug: "improved-combat-superiority", name: "Improved Combat Superiority", kind: "subclass", subclass: "battle-master",
        description: "Your superiority dice turn into d10s. At 18th level, they turn into d12s." },
    ]},
    { level: 11, features: [
      { slug: "extra-attack-2", name: "Extra Attack (2)", kind: "passive",
        description: "You can attack three times whenever you take the Attack action on your turn." },
    ]},
    { level: 12, features: [
      { slug: "asi-12", name: "Ability Score Improvement", kind: "asi",
        description: "Increase one ability score by 2, or two by 1. You can instead take a feat." },
    ]},
  ];

  const maneuvers = [
    { slug: "riposte", name: "Riposte", desc: "Reaction. When a creature misses you with a melee attack, expend one superiority die to make a melee weapon attack against the creature." },
    { slug: "trip-attack", name: "Trip Attack", desc: "On a hit, expend a die to add it to damage and knock the target prone if Large or smaller." },
    { slug: "disarming-attack", name: "Disarming Attack", desc: "On a hit, force the target to drop a held item. Add the die to damage." },
  ];

  // Race sample: Mountain Dwarf
  const race = {
    name: "Mountain Dwarf",
    parent: "Dwarf",
    size: "Medium",
    speed: 25,
    speed_notes: "Your speed is not reduced by wearing heavy armor.",
    languages: ["Common", "Dwarvish"],
    age: "Dwarves mature at the same rate as humans, but they're considered young until they reach the age of 50. On average, they live about 350 years.",
    asi: [{ ability: "Constitution", amount: 2 }, { ability: "Strength", amount: 2 }],
    traits: [
      { slug: "darkvision", name: "Darkvision",
        desc: "You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light." },
      { slug: "dwarven-resilience", name: "Dwarven Resilience",
        desc: "You have advantage on saving throws against poison, and you have resistance against poison damage." },
      { slug: "dwarven-combat-training", name: "Dwarven Combat Training",
        desc: "You have proficiency with the battleaxe, handaxe, light hammer, and warhammer." },
      { slug: "tool-proficiency", name: "Tool Proficiency", kind: "choice",
        desc: "You gain proficiency with the artisan's tools of your choice: smith's tools, brewer's supplies, or mason's tools." },
      { slug: "stonecunning", name: "Stonecunning",
        desc: "Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check." },
      { slug: "dwarven-armor-training", name: "Dwarven Armor Training",
        desc: "You have proficiency with light and medium armor." },
    ],
    subraces: [
      { slug: "mountain-dwarf", name: "Mountain Dwarf", summary: "+2 Strength, proficient with light and medium armor.", active: true },
      { slug: "hill-dwarf", name: "Hill Dwarf", summary: "+1 Wisdom, Dwarven Toughness." },
    ],
    source: "SRD 5.1",
  };

  // Background sample: Soldier
  const background = {
    name: "Soldier",
    skills: ["Athletics", "Intimidation"],
    tools: ["One type of gaming set", "Vehicles (land)"],
    languages: [],
    equipment: "An insignia of rank, a trophy taken from a fallen enemy, a set of bone dice or deck of cards, a set of common clothes, and a belt pouch containing 10 gp.",
    feature: {
      name: "Military Rank",
      desc: "You have a military rank from your career as a soldier. Soldiers loyal to your former military organization still recognize your authority and influence, and they defer to you if they are of lower rank. You can invoke your rank to exert influence over other soldiers and requisition simple equipment or horses for temporary use.",
    },
    traits: {
      personality: [
        "I'm always polite and respectful.",
        "I'm haunted by memories of war. I can't get the images of violence out of my mind.",
        "I've lost too many friends, and I'm slow to make new ones.",
      ],
      ideals: [
        "Greater Good. Our lot is to lay down our lives in defense of others. (Good)",
        "Responsibility. I do what I must and obey just authority. (Lawful)",
        "Independence. When people follow orders blindly, they embrace a kind of tyranny. (Chaotic)",
      ],
      bonds: [
        "I would still lay down my life for the people I served with.",
        "Someone saved my life on the battlefield. To this day, I will never leave a friend behind.",
        "My honor is my life.",
      ],
      flaws: [
        "The monstrous enemy we faced in battle still leaves me quivering with fear.",
        "I have little respect for anyone who is not a proven warrior.",
        "I obey the law, even if the law causes misery.",
      ],
    },
    source: "SRD 5.1",
  };

  // Class sample: Fighter (for the Preview modal header)
  const fighterClass = {
    name: "Fighter",
    hit_die: 10,
    primary_ability: "Strength or Dexterity",
    saving_throws: ["Strength", "Constitution"],
    armor: ["All armor", "Shields"],
    weapons: ["Simple weapons", "Martial weapons"],
    tools: [],
    skills: { choose: 2, from: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"] },
    description: "A master of martial combat, skilled with a variety of weapons and armor. Well-trained and disciplined, fighters range from hardened soldiers to armored champions and deadly duelists.",
    starting_equipment: "(a) chain mail or (b) leather armor, longbow, and 20 arrows; (a) a martial weapon and a shield or (b) two martial weapons; (a) a light crossbow and 20 bolts or (b) two handaxes; (a) a dungeoneer's pack or (b) an explorer's pack.",
    subclasses: [
      { slug: "champion", name: "Champion", summary: "Focused on raw physical power and critical strikes." },
      { slug: "battle-master", name: "Battle Master", summary: "Tactician who employs maneuvers fueled by superiority dice." },
      { slug: "eldritch-knight", name: "Eldritch Knight", summary: "Supplements martial prowess with abjuration and evocation magic." },
    ],
    source: "SRD 5.1",
  };

  return { fighterLevels, maneuvers, race, background, fighterClass };
})();
