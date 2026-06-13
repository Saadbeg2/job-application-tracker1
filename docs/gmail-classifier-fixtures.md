# Gmail Classifier Fixtures

These fixtures document expected behavior for the rule-based Gmail classifier. The app does not currently have a test runner configured, so these cases are kept as lightweight reference fixtures for future unit tests.

## LinkedIn CareerXperts

Input:

- Sender: `LinkedIn <jobs-noreply@linkedin.com>`
- Subject: `Saad Salman, your application was sent to CareerXperts Consulting`
- Snippet/body lines:
  - `Associate Software Engineer`
  - `CareerXperts Consulting · United States (Remote)`

Expected:

- `type`: `new_application`
- `company`: `CareerXperts Consulting`
- `role`: `Associate Software Engineer`
- `location`: `United States (Remote)`
- `suggestedStatus`: `Applied`
- `reason`: `LinkedIn body parser` or `LinkedIn subject parser` if body is unavailable

## LinkedIn Squadron Data Body Parser

Input:

- Sender: `LinkedIn <jobs-noreply@linkedin.com>`
- Subject: `Saad Salman, your application was sent to Squadron Data, Inc.`
- Cleaned body:
  - `Your application was sent to Squadron Data, Inc.`
  - `Snowflake Solutions Architect`
  - `Squadron Data, Inc.`
  - `Kansas City, MO`
  - `View similar jobs you may be interested in...`

Expected:

- `type`: `new_application`
- `company`: `Squadron Data, Inc.`
- `role`: `Snowflake Solutions Architect`
- `location`: `Kansas City, MO`
- `suggestedStatus`: `Applied`
- Body parsing should cut before `View similar jobs`.

## LinkedIn Similar Jobs Ignored

Input:

- Sender: `LinkedIn <jobs-noreply@linkedin.com>`
- Subject: `Saad Salman, your application was sent to Squadron Data, Inc.`
- Cleaned body starts with actual application details and later contains `View similar jobs`, followed by unrelated recommended jobs.

Expected:

- Company remains `Squadron Data, Inc.`
- Role/location must come only from the actual application section before `View similar jobs`.
- Recommended/similar jobs must not be extracted.

## Illumio / Ashby Role-at-Company

Input:

- Sender: `Ashby <notifications@ashbyhq.com>`
- Subject: `Thank you for applying for the Infrastructure Administrator I, Cloud AI Role at Illumio!`

Expected:

- `type`: `new_application`
- `company`: `Illumio`
- `role`: `Infrastructure Administrator I, Cloud AI`
- `suggestedStatus`: `Applied`
- `reason`: `Ashby role-at-company subject parser`

## Missing Role Stays Null

Input:

- Sender: `Rolfson Oil <noreply@applytojob.com>`
- Subject/body: `Saad, we've received your resume ... interest in employment at Rolfson Oil ... reviewed by our recruiting team`
- No role/title is explicitly present.

Expected:

- `type`: `new_application`
- `company`: `Rolfson Oil`
- `role`: `null`
- `suggestedStatus`: `Applied`
- The deterministic parser should not invent a role.

## LinkedIn Newsletter False Positive

Input:

- Sender: `LinkedIn <jobs-noreply@linkedin.com>`
- Subject/snippet: `Recommended jobs for you weekly digest unsubscribe`

Expected:

- `type`: `unknown_job_related`
- `confidence`: about `0.1`
- No ReviewItem should be created by Gmail scan because scan skips confidence `<= 0.2`.
