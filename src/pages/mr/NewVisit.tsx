
// Removed import of AppLayout
import { NewVisitForm } from "@/components/visits/NewVisitForm";
import { NewMedicalVisit } from "./NewMedicalVisit"; // Import the new component
import { useLocation } from "react-router-dom";

const NewVisit = () => {
  const location = useLocation();
  const type = new URLSearchParams(location.search).get("type");

  return (
    <> {/* Use a fragment to return multiple elements */}
      {type === "medical" ? <NewMedicalVisit /> : <NewVisitForm />}
    </>
  );
};

export default NewVisit;
