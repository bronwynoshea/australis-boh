import type { PatronPipelineStage, PatronPerson, PatronOrganisation, PatronActivity } from '../types';

// Mock pipeline stages
const mockStages: PatronPipelineStage[] = [
  {
    id: '1',
    key: 'lead',
    label: 'Lead',
    description: 'Initial contact or inquiry',
    sort_order: 1,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    key: 'prospect',
    label: 'Prospect',
    description: 'Qualified potential customer',
    sort_order: 2,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    key: 'qualified',
    label: 'Qualified',
    description: 'Ready for sales process',
    sort_order: 3,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '4',
    key: 'proposal',
    label: 'Proposal',
    description: 'Proposal sent',
    sort_order: 4,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '5',
    key: 'customer',
    label: 'Customer',
    description: 'Closed deal',
    sort_order: 5,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

// Mock people
const mockPeople: PatronPerson[] = [
  {
    id: '1',
    first_name: 'John',
    last_name: 'Smith',
    email: 'john.smith@example.com',
    phone: '+1-555-0101',
    source: 'Website',
    assigned_to: 'user1',
    created_by: 'user1',
    pipeline_stage_id: '2',
    created_at: '2024-03-15T10:00:00Z',
    updated_at: '2024-03-15T10:00:00Z'
  },
  {
    id: '2',
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: 'sarah.j@techcorp.com',
    phone: '+1-555-0102',
    source: 'Referral',
    assigned_to: 'user1',
    created_by: 'user1',
    pipeline_stage_id: '3',
    created_at: '2024-03-14T14:30:00Z',
    updated_at: '2024-03-14T14:30:00Z'
  },
  {
    id: '3',
    first_name: 'Michael',
    last_name: 'Brown',
    email: 'mbrown@startup.io',
    phone: '+1-555-0103',
    source: 'LinkedIn',
    assigned_to: 'user2',
    created_by: 'user1',
    pipeline_stage_id: '1',
    created_at: '2024-03-13T09:15:00Z',
    updated_at: '2024-03-13T09:15:00Z'
  },
  {
    id: '4',
    first_name: 'Emily',
    last_name: 'Davis',
    email: 'emily.d@enterprise.com',
    phone: '+1-555-0104',
    source: 'Cold Email',
    assigned_to: 'user1',
    created_by: 'user1',
    pipeline_stage_id: '4',
    created_at: '2024-03-12T16:45:00Z',
    updated_at: '2024-03-12T16:45:00Z'
  },
  {
    id: '5',
    first_name: 'David',
    last_name: 'Wilson',
    email: 'dwilson@company.net',
    phone: '+1-555-0105',
    source: 'Conference',
    assigned_to: 'user2',
    created_by: 'user1',
    pipeline_stage_id: '5',
    created_at: '2024-03-11T11:20:00Z',
    updated_at: '2024-03-11T11:20:00Z'
  }
];

// Mock organizations
const mockOrganisations: PatronOrganisation[] = [
  {
    id: '1',
    name: 'TechCorp Solutions',
    website: 'https://techcorp.com',
    industry: 'Technology',
    size: '50-100',
    status: 'Active',
    pipeline_stage_id: '3',
    created_at: '2024-03-10T08:00:00Z',
    updated_at: '2024-03-10T08:00:00Z'
  },
  {
    id: '2',
    name: 'Startup Innovations',
    website: 'https://startup.io',
    industry: 'Software',
    size: '10-25',
    status: 'Active',
    pipeline_stage_id: '1',
    created_at: '2024-03-09T13:30:00Z',
    updated_at: '2024-03-09T13:30:00Z'
  },
  {
    id: '3',
    name: 'Enterprise Systems',
    website: 'https://enterprise.com',
    industry: 'Consulting',
    size: '500+',
    status: 'Active',
    pipeline_stage_id: '4',
    created_at: '2024-03-08T10:15:00Z',
    updated_at: '2024-03-08T10:15:00Z'
  }
];

// Mock activities
const mockActivities: PatronActivity[] = [
  {
    id: '1',
    person_id: '1',
    organisation_id: null,
    type: 'call',
    body: 'Initial discovery call - interested in product features',
    created_by: 'user1',
    created_at: '2024-03-15T11:00:00Z'
  },
  {
    id: '2',
    person_id: '2',
    organisation_id: '1',
    type: 'email',
    body: 'Follow-up email with pricing information',
    created_by: 'user1',
    created_at: '2024-03-14T15:00:00Z'
  },
  {
    id: '3',
    person_id: '3',
    organisation_id: '2',
    type: 'meeting',
    body: 'Product demo scheduled for next week',
    created_by: 'user2',
    created_at: '2024-03-13T10:00:00Z'
  },
  {
    id: '4',
    person_id: '4',
    organisation_id: '3',
    type: 'task',
    body: 'Sent custom proposal for enterprise package',
    created_by: 'user1',
    created_at: '2024-03-12T17:00:00Z'
  },
  {
    id: '5',
    person_id: '5',
    organisation_id: null,
    type: 'note',
    body: 'Customer onboarded successfully',
    created_by: 'user2',
    created_at: '2024-03-11T12:00:00Z'
  }
];

// Mock API functions
export async function fetchPatronStages(): Promise<PatronPipelineStage[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  return mockStages;
}

export async function fetchPatronPeople(filters?: {
  search?: string;
  pipelineStageId?: string;
  assignedTo?: string;
}): Promise<PatronPerson[]> {
  await new Promise(resolve => setTimeout(resolve, 150));
  
  let filteredPeople = [...mockPeople];
  
  if (filters?.search) {
    const searchTerm = filters.search.toLowerCase();
    filteredPeople = filteredPeople.filter(person => 
      person.first_name?.toLowerCase().includes(searchTerm) ||
      person.last_name?.toLowerCase().includes(searchTerm) ||
      person.email?.toLowerCase().includes(searchTerm)
    );
  }
  
  if (filters?.pipelineStageId) {
    filteredPeople = filteredPeople.filter(person => 
      person.pipeline_stage_id === filters.pipelineStageId
    );
  }
  
  if (filters?.assignedTo) {
    filteredPeople = filteredPeople.filter(person => 
      person.assigned_to === filters.assignedTo
    );
  }
  
  return filteredPeople;
}

export async function fetchPatronOrganisations(filters?: {
  search?: string;
  pipelineStageId?: string;
}): Promise<PatronOrganisation[]> {
  await new Promise(resolve => setTimeout(resolve, 150));
  
  let filteredOrgs = [...mockOrganisations];
  
  if (filters?.search) {
    const searchTerm = filters.search.toLowerCase();
    filteredOrgs = filteredOrgs.filter(org => 
      org.name.toLowerCase().includes(searchTerm) ||
      org.website?.toLowerCase().includes(searchTerm)
    );
  }
  
  if (filters?.pipelineStageId) {
    filteredOrgs = filteredOrgs.filter(org => 
      org.pipeline_stage_id === filters.pipelineStageId
    );
  }
  
  return filteredOrgs;
}

export async function fetchPatronActivities(filters?: {
  personId?: string;
  organisationId?: string;
}): Promise<PatronActivity[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  let filteredActivities = [...mockActivities];
  
  if (filters?.personId) {
    filteredActivities = filteredActivities.filter(activity => 
      activity.person_id === filters.personId
    );
  }
  
  if (filters?.organisationId) {
    filteredActivities = filteredActivities.filter(activity => 
      activity.organisation_id === filters.organisationId
    );
  }
  
  return filteredActivities;
}

export async function fetchPatronPersonById(personId: string): Promise<PatronPerson | null> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return mockPeople.find(person => person.id === personId) || null;
}

export async function fetchPatronOrganisationById(organisationId: string): Promise<PatronOrganisation | null> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return mockOrganisations.find(org => org.id === organisationId) || null;
}
