/**
 * Test script to verify the unified calculateMatchScore function
 * Tests the specific case mentioned: MoraxZhongliXiao with College Athletic and Arts Scholarship
 */

import { calculateMatchScore } from './calculateMatchScore.js';

// Test case 1: MoraxZhongliXiao (College student, not athlete/artist)
const moraxProfile = {
  name: 'MoraxZhongliXiao',
  educationLevel: 'College / Undergraduate',
  location: 'Quezon City',
  gpa: 1.75,
  fieldOfStudy: 'Computer Science',
  specialCategories: {
    isAthlete: false,
    isArtist: false,
  }
};

const collegeAthletic = {
  name: 'College Athletic and Arts Scholarship',
  requiredEducationLevel: 'College / Undergraduate',
  minimumGPA: 2.5
};

console.log('TEST 1: MoraxZhongliXiao - College Athletic and Arts Scholarship');
console.log('Profile:', moraxProfile);
console.log('Scholarship:', collegeAthletic.name);
const result1 = calculateMatchScore(moraxProfile, collegeAthletic);
console.log('Result:', result1);
console.log('Expected: qualified=false, score=0 or partial (missing athlete/artist)');
console.log('---\n');

// Test case 2: MoraxZhongliXiao with Economic Scholarship (should qualify)
const economicScholarship = {
  name: 'Economic Scholarship',
  requiredEducationLevel: 'College / Undergraduate',
  minimumGPA: 2.5
};

const economicProfile = {
  name: 'MoraxZhongliXiao',
  educationLevel: 'College / Undergraduate',
  location: 'Quezon City',
  gpa: 1.75,
  financialNeed: 5,
  incomeCategory: '₱10,000 – ₱25,000',
  fieldOfStudy: 'Computer Science',
  specialCategories: {
    isFromIndigenousFamily: true
  }
};

console.log('TEST 2: MoraxZhongliXiao - Economic Scholarship (with financial need)');
console.log('Profile:', economicProfile);
console.log('Scholarship:', economicScholarship.name);
const result2 = calculateMatchScore(economicProfile, economicScholarship);
console.log('Result:', result2);
console.log('Expected: qualified=true, score=100');
console.log('---\n');

// Test case 3: Youth Leaders (missing sk official)
const youthLeaders = {
  name: 'College Youth Leaders Scholarship',
  requiredEducationLevel: 'College / Undergraduate',
  minimumGPA: 2.5
};

console.log('TEST 3: MoraxZhongliXiao - College Youth Leaders Scholarship');
console.log('Profile:', moraxProfile);
console.log('Scholarship:', youthLeaders.name);
const result3 = calculateMatchScore(moraxProfile, youthLeaders);
console.log('Result:', result3);
console.log('Expected: qualified=false (not SK official or student leader)');
console.log('---\n');

// Test case 4: Not QC resident (should fail immediately)
const nonQCProfile = {
  name: 'Student Outside QC',
  educationLevel: 'College / Undergraduate',
  location: 'Manila',
  gpa: 1.5,
  fieldOfStudy: 'Nursing'
};

console.log('TEST 4: Non-QC resident - College Academic Scholarship');
console.log('Profile:', nonQCProfile);
const academicScholarship = {
  name: 'College Academic Scholarship',
  requiredEducationLevel: 'College / Undergraduate',
  minimumGPA: 2.0
};
const result4 = calculateMatchScore(nonQCProfile, academicScholarship);
console.log('Result:', result4);
console.log('Expected: qualified=false, score=0 (not QC resident - immediate fail)');
console.log('---\n');

// Test case 5: Scholar of another LGU (should fail)
const anotherLGUProfile = {
  name: 'Scholar of Another LGU',
  educationLevel: 'College / Undergraduate',
  location: 'Quezon City',
  gpa: 1.5,
  isScholarOfAnotherLGU: true,
  fieldOfStudy: 'Engineering'
};

console.log('TEST 5: Scholar of another LGU - College Academic Scholarship');
console.log('Profile:', anotherLGUProfile);
const result5 = calculateMatchScore(anotherLGUProfile, academicScholarship);
console.log('Result:', result5);
console.log('Expected: qualified=false, score=0 (scholar of another LGU - immediate fail)');
console.log('---\n');

console.log('All tests completed! Review results above to verify unified calculateMatchScore works correctly.');
