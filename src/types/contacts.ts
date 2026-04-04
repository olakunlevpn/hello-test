export interface CalendarEvent {
  id?: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  isAllDay?: boolean;
  organizer?: { emailAddress: { name: string; address: string } };
}

export interface Contact {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  emailAddresses: {
    name?: string;
    address: string;
  }[];
  companyName?: string;
  jobTitle?: string;
}

export interface Person {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  scoredEmailAddresses: {
    address: string;
    relevanceScore: number;
  }[];
  companyName?: string;
  jobTitle?: string;
  personType: {
    class: string;
    subclass: string;
  };
}
