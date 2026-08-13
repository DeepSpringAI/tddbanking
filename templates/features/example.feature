@capability:example
Feature: Example capability

  # Written by /tddbanking:init so `npm run test:bank` goes green immediately.
  # Delete this file once your first real capability has scenarios.

  @smoke
  Scenario: The application loads
    When I open the home page
    Then the page has loaded

  # evidence: placeholder, replace with a discovered scenario
  @draft @priority:low
  Scenario: A draft is never generated
    Given a scenario is tagged @draft
    When bddgen runs with --tags "not @draft"
    Then the scenario is skipped and needs no step definitions
