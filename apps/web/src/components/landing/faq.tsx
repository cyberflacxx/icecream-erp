'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';

const faqItems = [
  {
    question: 'Can multiple branches use the system?',
    answer:
      'Yes. Each branch has isolated stock and sales data. Central admin sees all branches.'
  },
  {
    question: 'Does it prevent negative stock?',
    answer:
      'Yes. The system blocks any transaction that would cause stock to go below zero.'
  },
  {
    question: 'Can I track production wastage?',
    answer:
      'Yes. Every production batch records expected vs actual output and calculates wastage percentage automatically.'
  },
  {
    question: 'Is it role-based?',
    answer: 'Yes. 9 roles with granular permissions. Users only see what their role allows.'
  },
  {
    question: 'Can I export reports?',
    answer: 'Yes. All reports export to CSV and PDF.'
  }
];

export function FaqSection() {
  return (
    <Accordion type="single" collapsible className="space-y-4">
      {faqItems.map((item, index) => (
        <AccordionItem key={item.question} value={`item-${index}`}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
