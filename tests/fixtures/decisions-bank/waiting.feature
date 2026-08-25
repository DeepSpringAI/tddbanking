@capability:parked
Feature: Scenarios parked on a decision

  # evidence: /reports names a declined-consent doctor; docs/DISCLOSURE.md:88 promises otherwise
  @draft @from-crawl @needs-decision @decision:D-2 @priority:high
  Scenario: An undecided rule keeps one scenario parked
    Given something
    Then something

  # evidence: the same disagreement, seen on the export
  @draft @from-copy @needs-decision @decision:D-2 @priority:medium
  Scenario: A second scenario waits on the same question
    Given something
    Then something

  # evidence: pricing label on /quotations
  @draft @from-copy @needs-decision @decision:D-1 @priority:low
  Scenario: A scenario still parked on a decision that was answered
    Given something
    Then something

  # evidence: observed at /exports
  @draft @from-crawl @needs-decision @decision:D-9 @priority:low
  Scenario: A scenario parked on a question nobody wrote down
    Given something
    Then something

  # evidence: observed at /settings
  @draft @from-crawl @needs-decision @priority:low
  Scenario: A scenario parked with no id at all
    Given something
    Then something

  # evidence: src/components/Empty.tsx:12 says "No results" when the request failed
  @draft @from-copy @priority:high
  Scenario: An unrelated draft in the same round proceeds
    Given something
    Then something

  @from-copy @smoke
  Scenario: A live copy scenario
    Given something
    Then something
