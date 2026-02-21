package config

import "testing"

func TestParseHexColor(t *testing.T) {
	got, err := ParseHexColor("#112233")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Expect 0x00BBGGRR = 0x00332211
	if want := uint32(0x00332211); got != want {
		t.Fatalf("got 0x%06X, want 0x%06X", got, want)
	}
	if _, err := ParseHexColor("#xyz"); err == nil {
		t.Fatalf("expected error for bad hex")
	}
}

func TestFinalizeMerge(t *testing.T) {
	def := EffectiveConfig{Grid: 3, Keys: "nums", Confirm: "auto", OverlayAlpha: 220, OverlayBg: "#303030"}
	p1 := AppConfigPartial{Grid: intPtr(4), Keys: strPtr("qwe")}
	p2 := AppConfigPartial{Confirm: strPtr("enter"), OverlayAlpha: intPtr(200)}
	merged := p1.Merge(p2).Finalize(def)
	if merged.Grid != 4 || merged.Keys != "qwe" || merged.Confirm != "enter" || merged.OverlayAlpha != 200 {
		t.Fatalf("unexpected merged: %#v", merged)
	}
}

func intPtr(v int) *int       { return &v }
func strPtr(v string) *string { return &v }
