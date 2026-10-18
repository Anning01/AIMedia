import { CanvasWorkspace } from "@/features/image-maker/CanvasWorkspace";
import { ImageGenerationDialog } from "@/features/image-maker/ImageGenerationDialog";
import { useImageMaker } from "@/features/image-maker/useImageMaker";
export default function ImageMaker() {
  const {
    contextHolder,
    catInfo,
    cat,
    setCat,
    pickTemplate,
    tmpls,
    tmplId,
    downloadPng,
    canvasRef,
    bg,
    moveDrag,
    dragRef,
    layers,
    selectedId,
    startDrag,
    setSelectedId,
    selected,
    patchLayer,
    setBg,
    setAiOpen,
    uploadBg,
    saveToAssets,
    aiOpen,
    generateAi,
    aiLoading,
    aiPrompt,
    setAiPrompt,
    aiStyle,
    setAiStyle,
  } = useImageMaker();
  return (
    <div>
      <div className="mb-4">
        <h1 className="m-0 text-[22px] leading-tight font-semibold tracking-[-0.02em]">
          贴图工坊
        </h1>
        <p className="mt-1 mb-0 text-xs text-muted-foreground">
          套用模板制作封面与贴图，导出 PNG 或存入素材库
        </p>
      </div>
      {contextHolder}
      <CanvasWorkspace
        catInfo={catInfo}
        cat={cat}
        setCat={setCat}
        pickTemplate={pickTemplate}
        tmpls={tmpls}
        tmplId={tmplId}
        downloadPng={downloadPng}
        canvasRef={canvasRef}
        bg={bg}
        moveDrag={moveDrag}
        dragRef={dragRef}
        layers={layers}
        selectedId={selectedId}
        startDrag={startDrag}
        setSelectedId={setSelectedId}
        selected={selected}
        patchLayer={patchLayer}
        setBg={setBg}
        setAiOpen={setAiOpen}
        uploadBg={uploadBg}
        saveToAssets={saveToAssets}
      />

      <ImageGenerationDialog
        aiOpen={aiOpen}
        setAiOpen={setAiOpen}
        generateAi={generateAi}
        aiLoading={aiLoading}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        aiStyle={aiStyle}
        setAiStyle={setAiStyle}
      />
    </div>
  );
}
