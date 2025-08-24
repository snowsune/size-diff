from django.shortcuts import render
from django.views.generic import TemplateView


class SizeDiffView(TemplateView):
    template_name = "size_diff/index.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["title"] = "Vixi's Size-Difference Calculator!"
        return context


def size_diff_calculator(request):
    """Main size difference calculator view"""
    return render(
        request,
        "size_diff/calculator.html",
        {"title": "Vixi's Size-Difference Calculator!"},
    )
