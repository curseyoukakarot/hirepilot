import React, { useState, useEffect } from "react";
import { FaEdit, FaRobot } from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";

export default function JobDetailsCard({ job }) {
  const [editingField, setEditingField] = useState(null);
  const [formData, setFormData] = useState({
    department: job.department || "",
    location: job.location || "",
    experience_level: job.experience_level || "",
    salary_range: job.salary_range || ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData({
      department: job.department || "",
      location: job.location || "",
      experience_level: job.experience_level || "",
      salary_range: job.salary_range || ""
    });
  }, [job?.id, job?.department, job?.location, job?.experience_level, job?.salary_range]);

  const handleSave = async (field) => {
    await supabase
      .from("job_requisitions")
      .update({ [field]: formData[field] })
      .eq("id", job.id);
    setEditingField(null);
  };

  const handleGenerateAI = async () => {
    setLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/enrich-job-details`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: job.description })
        }
      );
      const data = await resp.json();
      const next = {
        department: data.department || "",
        location: data.location || "",
        experience_level: data.experience_level || "",
        salary_range: data.salary_range || ""
      };
      setFormData((prev) => ({ ...prev, ...next }));
      // Persist to Supabase so it survives refresh
      await supabase
        .from("job_requisitions")
        .update(next)
        .eq("id", job.id);
    } catch (err) {
      console.error("AI enrichment failed", err);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (label, field) => (
    <div>
      <label className="text-sm font-medium text-gray-500">{label}</label>
      {editingField === field ? (
        <div className="flex gap-2">
          <input
            type="text"
            className="border rounded px-2 py-1 text-sm flex-1"
            value={formData[field]}
            onChange={(e) =>
              setFormData({ ...formData, [field]: e.target.value })
            }
          />
          <button
            className="text-blue-600 text-sm"
            onClick={() => handleSave(field)}
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-900">
            {formData[field] || <span className="text-gray-400">—</span>}
          </p>
          <button
            className="text-gray-400 hover:text-gray-600"
            onClick={() => setEditingField(field)}
          >
            <FaEdit />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h3>
      <div className="space-y-3">
        {renderField("Department", "department")}
        {renderField("Location", "location")}
        {renderField("Experience Level", "experience_level")}
        {renderField("Salary Range", "salary_range")}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700"
          onClick={handleGenerateAI}
          disabled={loading}
        >
          <FaRobot />
          {loading ? "Generating..." : "Generate with AI"}
        </button>
      </div>
    </div>
  );
}

