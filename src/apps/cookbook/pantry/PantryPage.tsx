import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PantryHeader from "./components/PantryHeader";
import SoundbyteList from "./components/SoundbyteList";
import AIPersonaList from "./components/AIPersonaList";
import KnowledgePackList from "./components/KnowledgePackList";
import {
  listSoundbytes,
  listAIPersonas,
  listKnowledgePacks,
} from "./services/pantryApi";
import type { SoundbyteProfile, AIPersona, AIKnowledgePack } from "./types/pantry";

const PantryPage: React.FC = () => {
  const navigate = useNavigate();
  const [soundbytes, setSoundbytes] = useState<SoundbyteProfile[]>([]);
  const [personas, setPersonas] = useState<AIPersona[]>([]);
  const [knowledgePacks, setKnowledgePacks] = useState<AIKnowledgePack[]>([]);

  useEffect(() => {
    void (async () => {
      const [sb, ps, kp] = await Promise.all([
        listSoundbytes(),
        listAIPersonas(),
        listKnowledgePacks(),
      ]);
      setSoundbytes(sb);
      setPersonas(ps);
      setKnowledgePacks(kp);
    })();
  }, []);

  return (
    <div className="min-h-full w-full px-4 py-6 lg:px-8 lg:py-8">
      <PantryHeader />
      <SoundbyteList
        items={soundbytes}
        onManage={() => {
          if (soundbytes.length > 0) {
            const primary = soundbytes[0];
            navigate(`/boh/cookbook/pantry/soundbytes/${primary.id}`);
          } else {
            navigate("/boh/cookbook/pantry/soundbytes");
          }
        }}
        onRowClick={(item) => navigate(`/boh/cookbook/pantry/soundbytes/${item.id}`)}
      />
      <AIPersonaList
        items={personas}
        onManage={() => navigate("/boh/cookbook/pantry/personas")}
      />
      <KnowledgePackList
        items={knowledgePacks}
        onManage={() => navigate("/boh/cookbook/pantry/knowledge-packs")}
      />
    </div>
  );
};

export default PantryPage;
