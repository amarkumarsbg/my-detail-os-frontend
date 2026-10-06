import { InspectionEditor } from "@/components/inspections/inspection-editor";

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InspectionEditor key={id} id={id} />;
}