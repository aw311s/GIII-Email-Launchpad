# Campaign Prep Tool Roadmap


## Purpose


The Campaign Prep Tool is an internal application for G-III CRM that automates the email campaign preparation process.


Instead of manually gathering information from multiple systems, the application combines data from:


- Excel Workbook
- Workzone
- Box
- Klaviyo


into a single dashboard.


---


# Current Workflow


Today the manual workflow is:


Minjee creates Workzone project
        ↓
Workbook is updated
        ↓
Download assets from Box
        ↓
Build email in Klaviyo
        ↓
Proof
        ↓
Schedule


---


# Future Workflow


Select Brand
      ↓
Load Workbook
      ↓
Select Campaign
      ↓
Find Workzone Project
      ↓
Retrieve:
- Subject Line
- Preheader
- Box Link


      ↓


Retrieve Box Assets
- Reference JPG
- Email slices


      ↓


Prepare Klaviyo Campaign


---


# Project Status


## ✅ Completed


Frontend


- React
- Vite
- Workbook Upload
- Campaign Parser
- Campaign Dashboard
- Campaign Selector
- Copy Fields


Backend


- Express Server
- Route Layer
- Service Layer
- API Layer
- Config Layer


Data Model


- Workbook
- Workzone
- Box
- Klaviyo
- Status


---


## 🚧 Next


### Workzone


- OAuth Authentication
- Project Lookup
- Subject Line
- Preheader
- Project URL
- Box Link


### Box


- Folder lookup
- Reference image
- Slice discovery


### Klaviyo


- Template preparation
- Asset upload
- Campaign creation


---


# Long-Term Vision


A CRM user should be able to:


1. Select a brand.
2. Select a campaign.
3. Click "Prepare Campaign".
4. Have all assets, links, subject lines, and metadata automatically assembled.


The goal is to reduce repetitive manual work and eliminate copy/paste errors.



