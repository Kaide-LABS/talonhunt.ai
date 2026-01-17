export interface Challenge {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  language: string;
  description: string;
  starterCode: string;
}

export const challenges: Challenge[] = [
  {
    id: 'fizzbuzz',
    title: 'FizzBuzz',
    difficulty: 'easy',
    language: 'python',
    description: `Write a program that prints the numbers from 1 to 100.
For multiples of 3, print "Fizz" instead of the number.
For multiples of 5, print "Buzz" instead of the number.
For multiples of both 3 and 5, print "FizzBuzz".`,
    starterCode: `# FizzBuzz
# Print numbers 1-100, but:
# - Multiples of 3: print "Fizz"
# - Multiples of 5: print "Buzz"
# - Multiples of both: print "FizzBuzz"

def fizzbuzz():
    # Your code here
    pass

# Run your solution
fizzbuzz()
`,
  },
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'medium',
    language: 'python',
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

Example:
Input: nums = [2, 7, 11, 15], target = 9
Output: [0, 1]
Explanation: nums[0] + nums[1] = 2 + 7 = 9`,
    starterCode: `# Two Sum
# Given an array of integers and a target, return indices
# of two numbers that add up to the target.
#
# Example: nums = [2, 7, 11, 15], target = 9 -> [0, 1]

def two_sum(nums: list[int], target: int) -> list[int]:
    # Your code here
    pass

# Test your solution
print(two_sum([2, 7, 11, 15], 9))  # Expected: [0, 1]
print(two_sum([3, 2, 4], 6))       # Expected: [1, 2]
`,
  },
  {
    id: 'dijkstra',
    title: "Dijkstra's Algorithm",
    difficulty: 'hard',
    language: 'python',
    description: `Implement Dijkstra's algorithm to find the shortest path from a starting node to all other nodes in a weighted graph.

The graph is represented as an adjacency list where graph[node] is a list of (neighbor, weight) tuples.

Return a dictionary mapping each node to its shortest distance from the start node.

Example:
graph = {
    'A': [('B', 1), ('C', 4)],
    'B': [('C', 2), ('D', 5)],
    'C': [('D', 1)],
    'D': []
}
dijkstra(graph, 'A') -> {'A': 0, 'B': 1, 'C': 3, 'D': 4}`,
    starterCode: `# Dijkstra's Algorithm
# Find shortest path from start node to all other nodes
# in a weighted graph.
#
# Hint: Use a priority queue (heapq module)
#
# Graph format: adjacency list with (neighbor, weight) tuples
# Return: dict mapping each node to its shortest distance

import heapq

def dijkstra(graph: dict, start: str) -> dict:
    # Your code here
    pass

# Test your solution
graph = {
    'A': [('B', 1), ('C', 4)],
    'B': [('C', 2), ('D', 5)],
    'C': [('D', 1)],
    'D': []
}
print(dijkstra(graph, 'A'))  # Expected: {'A': 0, 'B': 1, 'C': 3, 'D': 4}
`,
  },
];

// Helper to filter challenges by language
export function getChallengesForLanguage(language: string): Challenge[] {
  return challenges.filter((c) => c.language === language);
}

// Get difficulty badge color
export function getDifficultyColor(difficulty: Challenge['difficulty']): string {
  switch (difficulty) {
    case 'easy':
      return 'text-green-400';
    case 'medium':
      return 'text-yellow-400';
    case 'hard':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}
