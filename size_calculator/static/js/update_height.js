function updateHeight(index, species, gender, name) {
    let heightInput = document.getElementById(`height_${index}`);
    let newHeight = heightInput.value;

    if (newHeight <= 0 || isNaN(newHeight)) {
        alert("Please enter a valid height!");
        return;
    }

    let params = new URLSearchParams(window.location.search);
    let characters = params.get("characters") || "";

    let charArray = characters ? characters.split("+") : [];
    charArray[index] = `${species},${gender},${newHeight},${name}`;

    params.set("characters", charArray.join("+"));

    window.location.href = "?" + params.toString();
}