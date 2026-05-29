INTERNATIONAL STANDARD

ISO/IEC 33002

Second edition 2015-03-01

Information technology — Process assessment — Requirements for performing process assessment

Technologies de l’information — Évaluation du processus — Exigences relatives à la réalisation d’une évaluation du processus

Reference number ISO/IEC 33002:2015(E)

© ISO/IEC 2015

ISO/IEC 33002:2015(E)

COPYRIGHT PROTECTED DOCUMENT

© ISO/IEC 2015

All rights reserved. Unless otherwise specified, no part of this publication may be reproduced or utilized otherwise in any form or by any means, electronic or mechanical, including photocopying, or posting on the internet or an intranet, without prior written permission. Permission can be requested from either ISO at the address below or ISO’s member body in the country of the requester.

ISO copyright office

Case postale 56 • CH-1211 Geneva 20 Tel. + 41 22 749 01 11

Fax + 41 22 749 09 47

E-mail copyright@iso.org Web www.iso.org

Published in Switzerland

ii	© ISO/IEC 2015 – All rights reserved

ISO/IEC 33002:2015(E)

Contents	Page

© ISO/IEC 2015 – All rights reserved	iii

ISO/IEC 33002:2015(E)

# Foreword

ISO (the International Organization for Standardization) and IEC (the International Electrotechnical Commission) form the specialized system for worldwide standardization. National bodies that are members of ISO or IEC participate in the development of International Standards through technical committees established by the respective organization to deal with particular fields of technical activity. ISO and IEC technical committees collaborate in fields of mutual interest. Other international organizations, governmental and non-governmental, in liaison with ISO and IEC, also take part in the work. In the field of information technology, ISO and IEC have established a joint technical committee, ISO/IEC JTC 1.

The procedures used to develop this document and those intended for its further maintenance are described in the ISO/IEC Directives, Part 1. In particular the different approval criteria needed for the different types of document should be noted. This document was drafted in accordance with the editorial rules of the ISO/IEC Directives, Part 2 (see www.iso.org/directives).

Attention is drawn to the possibility that some of the elements of this document may be the subject of patent rights. ISO and IEC shall not be held responsible for identifying any or all such patent rights. Details of any patent rights identified during the development of the document will be in the Introduction and/or on the ISO list of patent declarations received (see www.iso.org/patents).

Any trade name used in this document is information given for the convenience of users and does not constitute an endorsement.

For an explanation on the meaning of ISO specific terms and expressions related to conformity assessment, as well as information about ISO’s adherence to the WTO principles in the Technical Barriers to Trade (TBT) see the following URL: Foreword - Supplementary information

The committee responsible for this document is ISO/IEC JTC 1, Information technology, SC 7, Software and systems engineering.

This second edition cancels and replaces clauses of ISO/IEC 15504-2:2003 and ISO/IEC/TR 15504- 7:2008, which have been technically revised.

iv	© ISO/IEC 2015 – All rights reserved

ISO/IEC 33002:2015(E)

# Introduction

This International Standard defines the minimum set of requirements for performing an assessment that will ensure assessment results are objective, consistent, repeatable, and representative of the assessed processes. The requirements help to ensure that the assessment output is self-consistent and to provide evidence to substantiate the ratings and to verify compliance with the requirements. Process assessment is applicable in the following circumstances:

by or on behalf of an organization with the objective of understanding the state of its own processes for process improvement;

by or on behalf of an organization with the objective of determining the suitability of its own processes for a particular requirement or category of requirements;

by or on behalf of one organization with the objective of determining the suitability of another organization’s processes for a particular purpose, contract, or category of contracts.

This International Standard is applicable across all application domains and sizes of organizations. Appropriate methods, techniques, and tools can be used to enable the assessment process to be effective and efficient.

This International Standard is part of a set of International Standards designed to provide a consistent and coherent framework for the assessment of process quality characteristics, based on objective evidence resulting from implementation of the processes. The framework for assessment covers processes employed in the development, maintenance, and use of systems across the information technology domain and those employed in the design, transition, delivery, and improvement of services. The set of International Standards, as a whole, addresses process quality characteristics of any type. Results of assessment can be applied for improving process performance, or for identifying and addressing risks associated with application of processes.

The ISO/IEC 330xx family of Standards defines the requirements and resources needed for process assessment. The overall architecture and content of the series is described in ISO/IEC 33001:2015.

Several International Standards in the ISO/IEC 330xx family of standards for process assessment are intended to replace and extend parts of the ISO/IEC 15504 series of Standards. ISO/IEC 33001, Annex A provides a detailed record of the relationship between the ISO/IEC 330xx family and the ISO/IEC 15504 series.

© ISO/IEC 2015 – All rights reserved	v

Normen-Download-Beuth-ZF Friedrichshafen AG-KdNr.5434033-LfNr.7042558001-2015-05-06 07:39

INTERNATIONAL STANDARD	ISO/IEC 33002:2015(E)

Information technology — Process assessment — Requirements for performing process assessment

## Scope

This International Standard defines the minimum set of requirements for performing an assessment that will ensure assessment results are objective, consistent, repeatable, and representative of the assessed processes.

The requirements defined in this International Standard can be used by or on behalf of an organization to

facilitate self-assessment,

provide a basis for improving process performance and mitigating process-related risk,

produce a rating of the achievement of the relevant process quality characteristic, and

provide an objective benchmark between organizations.

This International Standard is applicable across all application domains and sizes of organization.

NOTE	An organization can implement a set of integrated processes in a system.

## Normative references

The following documents, in whole or in part, are normatively referenced in this document and are indispensable for its application. For dated references, only the edition cited applies. For undated references, the latest edition of the referenced document (including any amendments) applies.

ISO/IEC 33001:2015, Information technology — Process assessment — Concepts and terminology

ISO/IEC 33003:2015, Information technology — Process assessment — Requirements for process measurement frameworks

ISO/IEC 33004:2015, Information technology — Process assessment — Requirements for process reference, process assessment and maturity models

## Terms and definitions

For the purposes of this document, the terms and definitions given in ISO/IEC 33001:2015; apply.

## Performing an assessment

The purpose of process assessment is to understand and assess the processes implemented by an organizational unit.

Figure 1 shows the key elements of the process assessment process.

© ISO/IEC 2015 – All rights reserved	1

ISO/IEC 33002:2015(E)

Figure 1 — Key elements of the process assessment process

Clause 4 sets out the requirements for performing an assessment conformant with this International Standard. The requirements help to ensure that the assessment output is self-consistent and provides evidence to substantiate the ratings.

### General requirements

The assessment shall be conducted according to a documented assessment process. The documented assessment process shall be capable of meeting the assessment purpose and shall be structured in a manner that ensures that the purpose for performing the assessment is satisfied, in terms of the rigour and independence of the assessment and its suitability for the intended use.

The documented assessment process shall prescribe a set of activities and tasks to be performed that meet all of the requirements defined in this International Standard. Specifically, the documented assessment process shall:

identify as a minimum, the assessment activities as defined in 4.2;

identify as a minimum the roles, responsibilities and competencies as defined in 4.3;

identify the classes of assessment for which the documented assessment process can be applied, and the nature and extent of tailoring associated with each class addressed by the documented process;

define the criteria for ensuring coverage for both the defined organizational scope and the defined process scope for the assessment, in terms of the strategy for collecting and analysing data;

identify the rating method(s) to be used in rating process attributes;

identify or define the aggregation method(s) to be used in determining ratings.

Classes of assessment are described in 4.6. They reflect different levels of confidence in the results of the assessment.

Different categories of independence for different types of bodies and personnel are described in Annex A, with criteria for their use.

The documented assessment process shall contain at minimum the following activities:

2	© ISO/IEC 2015 – All rights reserved

ISO/IEC 33002:2015(E)

### Assessment activities

The assessment process shall start with the assessment sponsor’s commitment to proceed.

#### Plan the assessment

A plan for the assessment shall be developed and documented, including at a minimum:

required inputs specified in this standard (refer to 4.4);

class of assessment (refer to 4.6);

category of independence of the body performing the assessment, the lead assessor and the other members of the assessment team (refer to Annex A)

communications to the personnel involved in the assessment;

identification of the documented assessment process including:

the strategy and techniques for the selection, identification, collection and analysis of objective evidence and data, to satisfy any requirements for coverage of the organizational scope or the process scope of the assessment as defined for the class of the assessment (refer 4.6);

the approach to derive an agreed process attribute rating, where relevant.

activities to be performed in performing the assessment;

resources and schedule assigned to these activities;

identification and definition of roles and responsibilities of the participants in the assessment;

criteria to verify that the requirements of this International Standard have been met;

description of the planned assessment outputs.

Roles and responsibilities for process assessment shall be assigned and communicated to personnel impacted by the assessment.

The plan for the assessment shall be approved by the assessment sponsor, and the approval shall be documented.

#### Collect the data

The data collected shall be sufficient to provide coverage of the organization scope and the process scope for the assessment, as specified for the selected class of the assessment. Data shall be collected on the basis of direct or indirect evidence that shall be sufficient for the class of assessment (refer to 4.6).

Evidence required for evaluating the processes within the assessment scope and additional information shall be collected in a systematic manner applying at minimum the following:

a correspondence between the organizational unit’s processes and the elements in the process assessment model, specified in the assessment scope, shall be established;

each process identified in the assessment scope shall be assessed on the basis of objective evidence;

objective evidence shall be identified and gathered to provide the basis for verification of the ratings;

objective evidence gathered for each process attribute for each process assessed shall be sufficient to meet the assessment purpose, assessment scope and class of assessment;

objective evidence collected for each process shall be representative of the implementation of the process across the organizational scope of the assessment, as required for the selected class of the assessment (refer to 4.6);

© ISO/IEC 2015 – All rights reserved	3

ISO/IEC 33002:2015(E)

objective evidence shall be collected for each element in the selected process assessment model, as required for the selected class of assessment (refer to 4.6);

information which is relevant to the assessment to support understanding of the output of the assessment shall be compiled.

#### Validate the data

The data validation approach for the assessment shall ensure that the requirements of this standard are met in respect of every process instance identified in the assessment scope, and that the coverage requirements are satisfied. The activities shall:

confirm that the evidence collected is objective;

ensure that the objective evidence is sufficient and representative to cover the assessment purpose and class of assessment;

confirm that the data collected provides coverage of the organization scope and the process scope of the assessment, as required for the selected class of the assessment (refer 4.6);

ensure that the data as a whole is consistent.

#### Determine the results

The defined set of assessment indicators in the process assessment model shall be used to support the assessors’ judgement when analysing the validated data.

The process attribute ratings shall be expressed in terms that are consistent with the process measurement framework.

The assessment team shall perform the following activities:

rate the process attributes according to the selected rating method;

aggregate the rating(s) using the selected aggregation method(s), where applicable;

maintain traceability between a process attribute rating and the objective evidence used in determining that rating;

record the relationship between the assessment indicators for each process attribute rated and the objective evidence;

record the process profile and (if required) the process quality levels for the defined assessment scope;

derive the maturity level, if applicable.

The results from these activities shall be linked to the purpose of the assessment, and also linked to the business context for the assessment e.g. assessment purpose, target profile, or desired outcomes.

#### Report the assessment

Information which is relevant to the assessment and supports understanding of the output of the assessment shall be compiled. The assessment results shall be presented in a way that enables comparison, if required, and effective communication to the sponsor and affected parties.

The assessment report shall include at minimum the following:

general:

unique identifier;

date of issue;

4	© ISO/IEC 2015 – All rights reserved

ISO/IEC 33002:2015(E)

version number;

issuer of the document;

document change history.

the company and organizational unit being assessed;

the class of the assessment;

the names and roles of the assessors;

if applicable, the category of independence of the body performing the assessment, the lead assessor and the other members of the assessment team

the assessment participants (by name, role or functional area);

date and duration of the assessment;

reference to applicable standard(s) and requirements;

identification of models, e.g. process assessment model, maturity model;

identification of the process measurement framework;

the assessment results;

opportunities for improvement and risk mitigation, if applicable.

The assessment report shall be documented and issued to the assessment sponsor. An example of the content of an assessment report is shown in Annex B.

### Roles, responsibilities and competence

The roles and responsibilities defined for the assessment shall include the following:

The sponsor of the assessment shall:

verify that the individual who is to take responsibility for conformity to the assessment with this International Standard and designated as the lead assessor has the required competencies to perform the assessment;

finalize the scope of the assessment and approve the assessment plan;

ensure that resources are made available to conduct the assessment;

ensure that the assessment team has access to the relevant resources.

The lead assessor shall:

confirm the sponsor’s commitment to proceed with the assessment;

understand and document the objectives for the assessment from the sponsor;

verify that the assessment approach is in accordance with the requirements of this standard;

verify that the declared assessment scope accurately describes the actual scope being assessed;

ensure that participants in the assessment are briefed on the purpose, scope and approach of the assessment;

ensure that all members of the assessment team have knowledge and skills appropriate to their roles;

© ISO/IEC 2015 – All rights reserved	5

ISO/IEC 33002:2015(E)

ensure that all members of the assessment team have access to appropriate documented guidance on how to perform the defined assessment activities;

ensure that the assessment team has the competencies to use the tools chosen to support the assessment;

confirm receipt of the assessment result deliverables by the sponsor;

on completion of the assessment, verify and document the extent of conformance of the assessment to the requirements of this International Standard.

The assessor(s) shall carry out assigned activities associated with the assessment, e.g. detailed planning, data collection, data validation, rating the process attributes and reporting.

Assessors shall be competent on the basis of appropriate education, training and experience, including domain experience, to perform the required class of assessment and make professional judgements.

### Assessment inputs

The assessment inputs shall be defined prior to the data collection phase of an assessment and approved by the sponsor of the assessment.

Any changes in the assessment input shall be agreed with the sponsor or the sponsor’s delegated authority and documented in the assessment record.

At minimum, the assessment inputs shall specify the:

identity of the sponsor and the sponsor’s relationship to the organizational unit(s) being assessed;

business context including the organization business’s goals and circumstances of the assessment;

purpose of the assessment;

assessment scope as it applies to the business, including a defined and declared organization scope, including:

processes to be investigated within each organizational unit;

the process quality characteristic to be investigated, including the highest process quality level for each individual process within the assessment scope;

the organizational unit(s) that deploy the process;

context for the organizational unit(s) that deploy the processes including:

size of each organizational unit, e.g. number of personnel;

the application domain of the products or services of each organizational unit;

key characteristics (e.g. size, criticality, complexity and quality) of the products or services of each organizational unit.

sample of products, services, lifecycle stages or projects within the assessment scope.

identity of the model(s) and process measurement framework used:

process assessment model(s) conformant to ISO/IEC 33004:2015; including:

identification of relevant process reference model(s) conformant to ISO/IEC 33004:2015; and

6	© ISO/IEC 2015 – All rights reserved

ISO/IEC 33002:2015(E)

Identification of the process measurement framework conformant to ISO/IEC 33003:2015.

If relevant, a maturity model conformant to ISO/IEC 33004:2015.

assessment requirements, including:

documented assessment process to be employed;

class of assessment to be performed and the category of independence of the assessment;

rating method(s) to be employed;

aggregation method(s) to be employed.

assessment constraints considering, at minimum:

availability of key resources;

maximum duration of the assessment;

specific processes or organizational units to be excluded from the assessment;

ownership of the assessment outputs and any restrictions on their use;

controls for handling confidential information and non disclosure.

identity and roles of assessees, the assessment team and assessment support staff with specific responsibilities for the assessment;

criteria for competence of the lead assessor.

### Assessment record

The assessment record shall include at minimum the following:

date of the assessment;

identification of the assessment input;

identification of the objective evidence gathered;

identification of the documented assessment process;

set of process profiles resulting from the assessment;

maturity level, if applicable.

### Class of assessment

#### General

The purpose for performing an assessment may vary significantly, depending on the business and organizational context in which the assessment is performed. In particular, in some cases, there is a need to develop a high degree of confidence in the accuracy of the assessment results, and in the extent to which the result can be seen as representative of process performance across the whole organizational scope of the assessment. In order to ensure that the variety of needs can be met, three classes of assessment are identified, resulting in different levels of confidence in the results of the assessment. Specific requirements relating to each Class are contained in this Clause. The rating approach shall be appropriate for the classes of assessment.

NOTE  ISO/IEC 33010:2015; provides guidance on selecting the class of assessment, data collection and the rating approach that is appropriate for different classes of assessment [2].

© ISO/IEC 2015 – All rights reserved	7

ISO/IEC 33002:2015(E)

The Classes of assessment are defined below.

Class 1 assessment

The purpose of a Class 1 assessment is:

to provide a level of confidence in the results of the assessment such that the results are suited for comparisons across different organizations;

to enable assessment conclusions to be drawn as to the relative strengths and weaknesses of the organizations compared;

to provide a basis for process improvement, external benchmarking and process quality determination.

For a Class 1 assessment, specific requirements are defined relating to the planning for the assessment, collection and validation of data, the rating of process attributes, and the recording of the level of independence of the assessment team – refer 4.6.2.

Class 2 assessment

The purpose of a Class 2 assessment is:

to provide a level of confidence in the assessment results that may indicate the overall level of performance of the key processes in the organization unit, which are suitable for comparisons of the results of an assessment across an organizational or product line scope;

to enable assessment conclusions to be drawn about the opportunities for improvement and levels of process-related risk;

to provide a basis for an initial assessment at the commencement of an improvement program.

For a Class 2 assessment, specific requirements are defined relating to the collection and validation of data, the rating of process attributes, and the recording of the category of independence of the assessment team – refer 4.6.3.

Class 3 assessment

The purpose of a Class 3 assessment is:

to generate results that may indicate critical opportunities for improvement and key areas of process-related risk;

to be suitable for monitoring the ongoing progress of an improvement program, or to identify key issues for a later Class 1 or Class 2 assessment.

A Class 3 assessment meets the general requirements defined in this International Standard, without any specific additional requirements.

NOTE	Use of a Class 3 assessment to provide a rating of organizational process maturity is not recommended.

#### Specific requirements — Class 1 assessment

Assessment planning

In addition to the content defined in 4.2.1, the following shall be addressed in preparation of the assessment plan.

The category of independence of the body performing the assessment, the lead assessor and the other members of the assessment team shall be recorded. (Refer to Annex A and Clause 4.);

8	© ISO/IEC 2015 – All rights reserved

ISO/IEC 33002:2015(E)

The assessment team shall contain at least one assessor being the Lead Assessor;

A minimum of four process instances (where possible) shall be identified for each process within the scope of the assessment. If there are fewer than four process instances within the scope, then all process instances shall be selected.

Data collection and validation

In addition to the requirements defined in 4.2.2 and 4.2.3, the following additional requirement shall apply to the collection and validation of data:

a)  For each process outcome and each process attribute outcome in the scope of the assessment, across the set of process instances, objective evidence drawn both from evaluation of work products and from testimony of performers of the process shall be collected.

Determining results and reporting the assessment

In addition to the requirements defined in 4.2.4 and 4.2.5, the following additional requirements shall apply to the generation of process attribute ratings and the reporting of the results of the assessment:

The extent to which each process outcome and each process attribute outcome is achieved shall be characterized for each process instance, based on validated data;

The process attribute rating for every process attribute within the assessment scope shall be characterized for each process instance, based on validated data;

Where a process attribute rating cannot be characterized for the highest process attribute rating for any process instance, the issue(s) resulting in the lack of achievement shall be documented as a gap in performance;

The assessment team shall make a judgement whether the set of performance gaps identified for the process instances examined represent an overall weakness in performance, and what the extent of the weakness is. The individual gaps in performance, and any resulting weakness statements, shall be documented and retained in the assessment record;

Following the completion of rating of all of the processes within the assessment scope, the assessment team shall determine the set of process profiles and process quality levels;

Following the determination of the process quality levels, the assessment team shall determine the maturity level (optional) according to the selected maturity model;

The assessment report provided to the assessment sponsor shall be approved by the lead assessor, confirmed by all members of the assessment team, and authorized by the body performing the assessment.

#### Specific requirements — Class 2 assessment

Planning

In addition to the content defined in 4.2.1, the following shall be addressed in preparation of the assessment plan.

The category of independence of the body performing the assessment, the lead assessor and the other members of the assessment team shall be recorded. (Refer to Annex A);

The assessment team shall contain at least one assessor being the Lead Assessor;

A minimum of two process instances (where possible) shall be identified for each process within the scope of the assessment. If there are fewer than two process instances within the scope, then all process instances shall be selected.

© ISO/IEC 2015 – All rights reserved	9

ISO/IEC 33002:2015(E)

NOTE	It is recommended that the lead assessor is independent of the organizational unit being assessed.

Data collection and validation

In addition to the requirements defined in 4.2.2 and 4.2.3, the following additional requirement shall apply to the collection and validation of data:

a)  For each process attribute of each process instance, objective evidence drawn both from evaluation of work products and from testimony of performers of the process shall be collected for each process within the scope of the assessment.

Determining results and reporting the assessment

In addition to the requirements defined in 4.2.4 and 4.2.5, the following additional requirements shall apply to the generation of process attribute ratings and the reporting of the results of the assessment:

The process attribute rating for every process attribute within the assessment scope shall be characterized for each process instance, based on validated data;

Where a process attribute rating cannot be characterized for the highest process attribute rating for any process instance, the issue(s) resulting in the lack of achievement shall be documented as a gap in performance;

Following the completion of rating of all of the processes within the assessment scope, the assessment team shall determine the set of process profiles and process quality levels;

Following the determination of the process quality levels, the assessment team shall determine the maturity level (optional) according to the selected maturity model;

The assessment report provided to the assessment sponsor shall be approved by the lead assessor, confirmed by all members of the assessment team, and authorized by the body performing the assessment.

#### Specific requirements — Class 3 assessment

There are no specific requirements for a Class 3 assessment, beyond the general requirements set out in 4.1 to 4.5.

### Assessment of process capability

For the application of process assessment to the assessment of process capability, the process assessment model shall incorporate a process measurement framework based on process capability as the defined process quality characteristic.

NOTE  ISO/IEC 33020:2015; provides a process measurement framework for the assessment of process capability [3].

## Verifying conformity to process assessments

This clause is concerned with the mechanisms that may be used to verify that the requirements of this International Standard have been fulfilled.

Conformity of the assessment to the requirements of this International Standard may be verified by:

self-declaration (first party);

a second party;

a third party.

10	© ISO/IEC 2015 – All rights reserved

ISO/IEC 33002:2015(E)

The party performing verification shall ensure that the documented assessment process conforms to the requirements stated in 4.1, and that the performance of the assessment has conformed to the requirements stated in Clause 4. Objective evidence of conformance shall be retained.

The party performing the verification shall ensure that:

the process assessment model employed conforms to the requirements of ISO/IEC 33004:2015;

process reference model(s) employed conform to the requirements of ISO/IEC 33004:2015;

theprocessmeasurementframework employedconformstotherequirementsof ISO/IEC 33003:2015.

if relevant, any maturity model employed conforms to the requirements of ISO/IEC 33004:2015.

NOTE ISO/IEC29169:2015providesguidanceontheapplicationoftheconformityassessmentmethodology to the assessment of process quality characteristics and organizational process maturity[1].

© ISO/IEC 2015 – All rights reserved	11

ISO/IEC 33002:2015(E)

Annex A

(normative)

Categories of independence

Table A.1 sets out a typology that can be used to categorize the independence of different types of bodies and the make-up of the assessment team performing an assessment.

Category A might typically be an organization providing fully independent 3rd party services.

Category B might typically be an organization providing 2nd or 3rd party services where the assessment team is led by a lead assessor from the independent organization and where the other assessment team members may be from the organization being assessed. Such an approach may be used in a verification based approach where data is collected by internal team members.

Category C might typically be an internal but independent process group or quality assurance group within the organization being assessed but where there is a separate reporting line. This approach may be used in a large organization that has a separate functional group responsible for performing assessments.

Category D might typically be an internal consultant that is assisting an organization in implementing process improvement which then assesses their capabilities. Many small organizations may follow such an approach where there is no customer pressure for an independent assessment to be performed.

Table A.1 — Categories of independence of bodies and personnel performing assessment

|  | Category A | Category B | Category C | Category D |
|---|---|---|---|---|
| Body performing the assessment | The body performing the assessment shall be independ- ent of the organization being assessed. | The body performing the assessment shall be independ- ent of the organization being assessed. | The body performing the assessment shall be part of the organization being assessed. | The body performing the assessment shall be part of the organization being assessed. |
| Lead assessor | The lead assessor shall be independent of the organiza- tion being assessed | The lead assessor shall be independent of the organiza- tion being assessed | There shall be adequate separation of responsibil- ities of the lead assessor from personnel in the organizational unit being assessed. | The lead assessor can be part of the organizational unit being assessed. |
| Assessors<br>(other than lead assessor) | The assessors shall be inde- pendent of the organization being assessed. | There shall be a separation of the responsibilities of the assessors from personnel in the organizational unit being assessed. | There shall be a separation of the responsibilities of the assessors from personnel in the organizational unit being assessed. | The assessors can be part of the organizational unit being assessed. |

12	© ISO/IEC 2015 – All rights reserved

ISO/IEC 33002:2015(E)

Annex B

(informative)

Example content of an assessment report

An example of the contents of an assessment report is shown below.

General:

Unique identifier;

Date of issue;

Version number;

Issuer of the document;

Document distribution list;

Document change history.

A summary of assessment and result

The date and duration of the assessment

The company and organizational unit assessed:

Identification of the company;

Address of the company;

Identification of the organizational unit(s);

Address of the organizational unit(s);

The scope of supply;

The location(s) where the assessment was performed.

The class of assessment

The category of independence of the body performing the assessment, the lead assessor and the other members of the assessment team

The names and roles of the assessors, and their assessment body, if applicable

The assessment body, if applicable:

Identification of the assessment body;

Address of the assessment body;

The type of assessment body.

Reference to applicable standard(s) and requirements

The identification of process models and the process measurement framework:

Identification of the process assessment model(s);

© ISO/IEC 2015 – All rights reserved	13

ISO/IEC 33002:2015(E)

Identification of the process measurement framework;

Identification of the maturity model (if applicable).

The rating method and aggregation method used

The scope of the assessment:

The selected processes to be investigated within the scope of the assessment;

The organizational unit(s) that deploy the processes;

The process quality characteristic to be investigated, including the process quality level for each individual process within the assessment scope;

The maturity level to be assessed, if applicable;

Any exclusions and/or inclusions from/to the assessment scope.

The projects selected as a basis for assessment, if applicable, detailing:

Identifier;

Short description;

Application area;

Project start date;

Project end date;

Current life cycle phase;

Project team size;

Project team person months.

The services selected as basis for assessment, if applicable, detailing:

Identifier;

Short description;

Application area;

Service team size.

The assessment participants (by name, role, functional area)

The assessment results:

The set of process profiles including (where required) the process quality level(s);

The maturity level, if applicable;

Performance gaps and weaknesses established during process attribute rating;

Opportunities for improvement and risk mitigation, if applicable;

Any notes to the assessment.

Any additional information collected during the assessment

The assessment report release:

Approved by the lead assessor;

14	© ISO/IEC 2015 – All rights reserved

ISO/IEC 33002:2015(E)

Confirmed by all members of the assessment team;

Authorized by the assessment body performing the assessment (where relevant).

© ISO/IEC 2015 – All rights reserved	15

ISO/IEC 33002:2015(E)

# Bibliography

ISO/IEC 291691), Information technology — Process assessment — The application of conformity assessment methodology to the assessment to process quality characteristics and organizational maturity

ISO/IEC 330102), Information technology — Process assessment — Guide on process assessments

ISO/IEC 33020:2015, Information technology — Process assessment — Process measurement framework for assessment of process capability

To be published.

To be published.

16	© ISO/IEC 2015 – All rights reserved

Normen-Download-Beuth-ZF Friedrichshafen AG-KdNr.5434033-LfNr.7042558001-2015-05-06 07:39

ISO/IEC 33002:2015(E)

ICS 35.080

Price based on 16 pages

© ISO/IEC 2015 – All rights reserved

