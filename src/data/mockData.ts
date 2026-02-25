export interface Activity {
  id: string;
  name: string;
  category: 'cultural' | 'food' | 'adventure' | 'nature' | 'shopping' | 'entertainment';
  location: string;
  scheduledTime: string;
  duration: number; // minutes
  isOutdoor: boolean;
  isBooked: boolean;
  score: number; // 0-100 optimization score
  weatherImpact: 'none' | 'low' | 'high';
  crowdLevel: 'low' | 'medium' | 'high';
  trafficDelay: number; // minutes
  image: string;
  description: string;
  lat: number;
  lng: number;
}

export interface WeatherCondition {
  temp: number;
  feelsLike: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'partly-cloudy';
  rainProbability: number;
  humidity: number;
  windSpeed: number;
  icon: string;
  hourlyForecast: { hour: string; temp: number; rainProb: number; condition: string }[];
}

export interface TrafficCondition {
  overallDelay: number; // minutes
  congestionLevel: 'low' | 'moderate' | 'heavy' | 'severe';
  affectedRoutes: string[];
  alternativeAvailable: boolean;
}

export interface Suggestion {
  id: string;
  type: 'swap' | 'alternative' | 'timing' | 'route';
  title: string;
  description: string;
  reason: string;
  impact: string;
  priority: 'low' | 'medium' | 'high';
  originalActivity?: string;
  suggestedActivity?: Activity;
}

export const mockWeather: WeatherCondition = {
  temp: 24,
  feelsLike: 26,
  condition: 'partly-cloudy',
  rainProbability: 65,
  humidity: 72,
  windSpeed: 14,
  icon: '⛅',
  hourlyForecast: [
    { hour: '9 AM', temp: 22, rainProb: 10, condition: 'sunny' },
    { hour: '10 AM', temp: 23, rainProb: 15, condition: 'sunny' },
    { hour: '11 AM', temp: 24, rainProb: 30, condition: 'partly-cloudy' },
    { hour: '12 PM', temp: 25, rainProb: 45, condition: 'cloudy' },
    { hour: '1 PM', temp: 24, rainProb: 65, condition: 'rainy' },
    { hour: '2 PM', temp: 23, rainProb: 80, condition: 'rainy' },
    { hour: '3 PM', temp: 22, rainProb: 70, condition: 'rainy' },
    { hour: '4 PM', temp: 23, rainProb: 40, condition: 'cloudy' },
    { hour: '5 PM', temp: 24, rainProb: 20, condition: 'partly-cloudy' },
    { hour: '6 PM', temp: 23, rainProb: 10, condition: 'sunny' },
  ],
};

export const mockTraffic: TrafficCondition = {
  overallDelay: 18,
  congestionLevel: 'moderate',
  affectedRoutes: ['Downtown → Waterfront', 'Museum District → Old Town'],
  alternativeAvailable: true,
};

export const mockActivities: Activity[] = [
  {
    id: '1',
    name: 'Sunrise at the Cathedral',
    category: 'cultural',
    location: 'Historic Cathedral',
    scheduledTime: '9:00 AM',
    duration: 60,
    isOutdoor: false,
    isBooked: true,
    score: 92,
    weatherImpact: 'none',
    crowdLevel: 'low',
    trafficDelay: 0,
    image: '',
    description: 'Explore the stunning Gothic architecture and stained glass windows.',
    lat: 41.4025,
    lng: 2.1743,
  },
  {
    id: '2',
    name: 'Botanical Garden Walk',
    category: 'nature',
    location: 'Royal Botanical Gardens',
    scheduledTime: '10:30 AM',
    duration: 90,
    isOutdoor: true,
    isBooked: false,
    score: 54,
    weatherImpact: 'high',
    crowdLevel: 'medium',
    trafficDelay: 8,
    image: '',
    description: 'A peaceful stroll through rare tropical plants and scenic pathways.',
    lat: 41.3930,
    lng: 2.1637,
  },
  {
    id: '3',
    name: 'Local Market & Street Food',
    category: 'food',
    location: 'La Boqueria Market',
    scheduledTime: '12:30 PM',
    duration: 75,
    isOutdoor: true,
    isBooked: false,
    score: 68,
    weatherImpact: 'low',
    crowdLevel: 'high',
    trafficDelay: 12,
    image: '',
    description: 'Taste authentic local flavors and browse fresh produce stalls.',
    lat: 41.3816,
    lng: 2.1719,
  },
  {
    id: '4',
    name: 'Modern Art Museum',
    category: 'cultural',
    location: 'MACBA',
    scheduledTime: '2:30 PM',
    duration: 120,
    isOutdoor: false,
    isBooked: true,
    score: 88,
    weatherImpact: 'none',
    crowdLevel: 'low',
    trafficDelay: 5,
    image: '',
    description: 'Contemporary masterpieces in a landmark Richard Meier building.',
    lat: 41.3833,
    lng: 2.1670,
  },
  {
    id: '5',
    name: 'Sunset Kayaking',
    category: 'adventure',
    location: 'Barceloneta Beach',
    scheduledTime: '5:00 PM',
    duration: 90,
    isOutdoor: true,
    isBooked: true,
    score: 45,
    weatherImpact: 'high',
    crowdLevel: 'medium',
    trafficDelay: 15,
    image: '',
    description: 'Paddle along the coast with stunning views of the city skyline.',
    lat: 41.3752,
    lng: 2.1894,
  },
  {
    id: '6',
    name: 'Rooftop Dinner',
    category: 'food',
    location: 'Sky Terrace Restaurant',
    scheduledTime: '7:30 PM',
    duration: 120,
    isOutdoor: true,
    isBooked: true,
    score: 76,
    weatherImpact: 'low',
    crowdLevel: 'low',
    trafficDelay: 10,
    image: '',
    description: 'Mediterranean cuisine with panoramic views over the city lights.',
    lat: 41.3874,
    lng: 2.1686,
  },
];

export const mockSuggestions: Suggestion[] = [
  {
    id: 's1',
    type: 'swap',
    title: 'Move Garden Walk to Evening',
    description: 'Rain is expected 1–3 PM. Swap Botanical Garden to 5 PM when skies clear.',
    reason: 'Rain probability 80% at scheduled time',
    impact: 'Score improves from 54 → 82',
    priority: 'high',
    originalActivity: '2',
  },
  {
    id: 's2',
    type: 'alternative',
    title: 'Replace Kayaking with Harbor Cruise',
    description: 'Wind speeds too high for kayaking. A sheltered harbor cruise offers similar views.',
    reason: 'Wind speed 14 km/h exceeds safe limit',
    impact: 'Safer experience, similar enjoyment',
    priority: 'high',
    originalActivity: '5',
  },
  {
    id: 's3',
    type: 'timing',
    title: 'Visit Market Before Noon',
    description: 'Crowd density peaks at 1 PM. Arriving at 11:30 AM avoids the rush.',
    reason: 'Crowd level: High at scheduled time',
    impact: 'Wait times reduced by ~20 min',
    priority: 'medium',
    originalActivity: '3',
  },
  {
    id: 's4',
    type: 'route',
    title: 'Optimize Route via Coastal Road',
    description: 'Downtown congestion adds 18 min. Coastal route saves 12 min overall.',
    reason: 'Moderate traffic on primary routes',
    impact: 'Save 12 minutes total travel time',
    priority: 'low',
  },
];
